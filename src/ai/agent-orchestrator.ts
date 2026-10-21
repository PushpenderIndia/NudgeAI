import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRuns,
  agentSteps,
  emails,
  meetingPrep,
  meetings,
  pendingActions,
  tasks,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { completeText, hasApiKey, resolveModel } from "@/ai/client";

export const AGENTS = [
  { name: "Scribe", role: "Meeting notes and actions", tool: "meetings" },
  { name: "Courier", role: "Email triage and drafts", tool: "email" },
  { name: "Tracker", role: "GitHub and Jira updates", tool: "github / Jira" },
  { name: "Planner", role: "Tasks and reminders", tool: "tasks" },
  { name: "Historian", role: "Context from past work", tool: "search" },
  { name: "Reporter", role: "Weekly reporting", tool: "activity" },
] as const;

type Workflow = "urgent_email" | "meeting_ended" | "start_day";
const WORKFLOW_TITLES: Record<Workflow, string> = {
  urgent_email: "Urgent email: triage and draft a reply",
  meeting_ended: "Meeting ended: write minutes and plan actions",
  start_day: "Start my day: prepare the agenda",
};

function modelLabel(tier: "fast" | "heavy") {
  return `${tier === "fast" ? "Nemotron Nano/Super" : "Nemotron Ultra"} · ${resolveModel(tier)}`;
}

async function modelSummary(tier: "fast" | "heavy", system: string, user: string, fallback: string) {
  if (!hasApiKey()) return fallback;
  return completeText({ tier, system, user, maxTokens: 220 });
}

async function step(
  runId: string,
  seq: number,
  input: {
    agent: string;
    action: string;
    tool: string;
    tier: "fast" | "heavy";
    inputSummary: string;
    outputSummary: string;
    handoffTo?: string;
  }
) {
  const startedAt = new Date();
  const inserted = await db.insert(agentSteps).values({
    runId,
    seq,
    agent: input.agent,
    action: input.action,
    tool: input.tool,
    model: modelLabel(input.tier),
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    status: "running",
    handoffTo: input.handoffTo,
    startedAt,
  }).returning({ id: agentSteps.id });
  await new Promise((resolve) => setTimeout(resolve, 220));
  await db.update(agentSteps).set({ status: "done", finishedAt: new Date() }).where(eq(agentSteps.id, inserted[0].id));
}

async function createRun(trigger: Workflow, title: string) {
  const inserted = await db.insert(agentRuns).values({ trigger, title, status: "running" }).returning({ id: agentRuns.id });
  return inserted[0].id;
}

async function finishRun(runId: string, status: "done" | "waiting_for_user" | "failed") {
  await db.update(agentRuns).set({ status, finishedAt: new Date() }).where(eq(agentRuns.id, runId));
}

async function prepareMeeting(runId: string, meeting: typeof meetings.$inferSelect, seq: number) {
  const prepSummary = await modelSummary(
    "heavy",
    "Write one concise meeting-prep summary for a corporate work assistant.",
    `Meeting: ${meeting.title}. Attendees: ${meeting.attendees.join(", ")}. Use the known Atlas/Northwind project context.`,
    "Last time, the team agreed to keep the Atlas export read-only until the review is complete."
  );
  await db.insert(meetingPrep).values({
    meetingId: meeting.id,
    status: "working",
  }).onConflictDoUpdate({ target: meetingPrep.meetingId, set: { status: "working" } });
  await step(runId, seq, {
    agent: "Historian",
    action: "Gather past context",
    tool: "meetings, email, Jira, commits, memory",
    tier: "fast",
    inputSummary: `Find context for ${meeting.title} with ${meeting.attendees.length} attendees.`,
    outputSummary: "Found the latest Atlas notes, two open actions, and related delivery work.",
    handoffTo: "Reporter",
  });
  await step(runId, seq + 1, {
    agent: "Reporter",
    action: "Write meeting prep",
    tool: "meeting_prep",
    tier: "heavy",
    inputSummary: "Turn the retrieved context into a short brief.",
    outputSummary: "Prep brief is ready with last time, open items, and three talking points.",
    handoffTo: "Nudge",
  });
  await db.insert(meetingPrep).values({
    meetingId: meeting.id,
    lastTimeSummary: prepSummary,
    decisions: ["Keep the client export read-only through review."],
    openItems: [
      { owner: "Pushpender", due: "Today", title: "Share the Atlas executive summary" },
      { owner: "Marcus", due: "This week", title: "Unblock the staging migration" },
    ],
    relatedEmails: ["Northwind asked for the assessment summary."],
    relatedIssues: ["ATLAS-142 · Rotate JWT signing keys"],
    relatedCommits: ["findings-export · add read-only export endpoint"],
    talkingPoints: ["Confirm the summary delivery date.", "Check the staging migration blocker.", "Agree the next Atlas review milestone."],
    status: "ready",
    generatedAt: new Date(),
  }).onConflictDoUpdate({
    target: meetingPrep.meetingId,
    set: {
      lastTimeSummary: prepSummary,
      decisions: ["Keep the client export read-only through review."],
      openItems: [
        { owner: "Pushpender", due: "Today", title: "Share the Atlas executive summary" },
        { owner: "Marcus", due: "This week", title: "Unblock the staging migration" },
      ],
      relatedEmails: ["Northwind asked for the assessment summary."],
      relatedIssues: ["ATLAS-142 · Rotate JWT signing keys"],
      relatedCommits: ["findings-export · add read-only export endpoint"],
      talkingPoints: ["Confirm the summary delivery date.", "Check the staging migration blocker.", "Agree the next Atlas review milestone."],
      status: "ready",
      generatedAt: new Date(),
    },
  });
}

export async function runWorkflow(workflow: Workflow, existingRunId?: string) {
  const runId = existingRunId ?? await createRun(workflow, WORKFLOW_TITLES[workflow]);
  try {
    if (workflow === "urgent_email") {
      const email = await db.select().from(emails).where(and(eq(emails.isSent, false), isNull(emails.triage))).orderBy(asc(emails.receivedAt)).get()
        ?? await db.select().from(emails).where(eq(emails.isSent, false)).orderBy(asc(emails.receivedAt)).get();
      if (!email) throw new Error("No demo email is available for this workflow.");
      await step(runId, 1, { agent: "Courier", action: "Triage urgent email", tool: "emails", tier: "fast", inputSummary: email.subject, outputSummary: "Marked urgent because it needs a same-day response.", handoffTo: "Historian" });
      await step(runId, 2, { agent: "Historian", action: "Retrieve related context", tool: "meetings, memory, emails", tier: "fast", inputSummary: "Search Atlas and Northwind history.", outputSummary: "Found last week’s Atlas decision and the sender’s preferred concise style.", handoffTo: "Courier" });
      const reply = await modelSummary("heavy", "Write a concise, friendly email reply. Do not send it.", `Subject: ${email.subject}\nBody: ${email.body}`, "Thanks for the note. I’m reviewing the Atlas summary and will share an update today.");
      await step(runId, 3, { agent: "Courier", action: "Draft reply", tool: "drafts", tier: "heavy", inputSummary: "Use the retrieved context and the user’s friendly tone.", outputSummary: "Reply draft prepared and held for approval.", handoffTo: "Planner" });
      const summary = `Reply to ${email.fromName}: ${email.subject}`;
      const existingAction = await db.select({ id: pendingActions.id }).from(pendingActions)
        .where(and(eq(pendingActions.status, "pending"), eq(pendingActions.summary, summary))).get();
      const action = existingAction
        ? [existingAction]
        : await db.insert(pendingActions).values({
            actionType: "send_email",
            summary,
            payload: { to: email.fromEmail, subject: `Re: ${email.subject}`, body: reply },
            runId,
          }).returning({ id: pendingActions.id });
      await step(runId, 4, { agent: "Planner", action: "Create urgent follow-up", tool: "tasks", tier: "fast", inputSummary: email.subject, outputSummary: "Urgent follow-up is ready in Today’s tasks.", handoffTo: "Nudge" });
      await db.insert(tasks).values({ title: `Reply to ${email.subject}`, priority: "urgent", source: "email", sourceId: email.id, runId, sortOrder: 0 });
      await logActivity({ action: "Courier prepared a reply", summary: `Waiting for your OK on ${email.subject}`, entityType: "agent_run", entityId: runId });
      await finishRun(runId, "waiting_for_user");
      return { runId, actionId: action[0].id };
    }

    if (workflow === "meeting_ended") {
      const meeting = await db.select().from(meetings).orderBy(asc(meetings.startsAt)).get();
      if (!meeting) throw new Error("No meeting is available for this workflow.");
      await step(runId, 1, { agent: "Scribe", action: "Read transcript", tool: "meetings", tier: "fast", inputSummary: meeting.title, outputSummary: "Transcript loaded and decisions identified.", handoffTo: "Scribe" });
      await step(runId, 2, { agent: "Scribe", action: "Write minutes", tool: "drafts", tier: "heavy", inputSummary: "Turn transcript into minutes.", outputSummary: "Minutes and action items prepared.", handoffTo: "Planner" });
      await step(runId, 3, { agent: "Planner", action: "Add action items", tool: "tasks", tier: "fast", inputSummary: "Extracted actions from the minutes.", outputSummary: "Action items added to Today’s tasks.", handoffTo: "Nudge" });
      await db.update(meetings).set({ hasMom: true }).where(eq(meetings.id, meeting.id));
      await db.insert(tasks).values({ title: "Review meeting action items", priority: "today", source: "meeting", sourceId: meeting.id, runId, sortOrder: 0 });
      await logActivity({ action: "Scribe wrote meeting notes", summary: `Planner added actions from ${meeting.title}`, entityType: "agent_run", entityId: runId });
      await finishRun(runId, "done");
      return { runId };
    }
    const upcoming = await db.select().from(meetings).orderBy(asc(meetings.startsAt)).limit(3);
    let seq = 1;
    for (const meeting of upcoming) {
      await prepareMeeting(runId, meeting, seq);
      seq += 2;
    }
    const existingPending = await db.select({ id: pendingActions.id }).from(pendingActions).where(eq(pendingActions.status, "pending")).limit(1);
    if (existingPending.length === 0) {
      const email = await db.select().from(emails).where(eq(emails.isSent, false)).orderBy(asc(emails.receivedAt)).get();
      if (email) {
        await db.insert(pendingActions).values({
          actionType: "send_email",
          summary: `Reply to ${email.fromName}: ${email.subject}`,
          payload: { to: email.fromEmail, subject: `Re: ${email.subject}`, body: "Thanks for the note. I’m reviewing the Atlas summary and will share an update today." },
          runId,
        });
      }
    }
    await logActivity({ action: "Nudge prepared your day", summary: `${upcoming.length} meeting briefs are ready`, entityType: "agent_run", entityId: runId });
    await finishRun(runId, "done");
    return { runId };
  } catch (error) {
    await finishRun(runId, "failed");
    throw error;
  }
}

export async function startWorkflow(workflow: Workflow) {
  const runId = await createRun(workflow, WORKFLOW_TITLES[workflow]);
  void runWorkflow(workflow, runId).catch((error) => {
    console.error(`Agent workflow failed: ${workflow}`, error);
  });
  return { runId };
}

export async function ensureDayStarted() {
  const existing = await db.select({ id: agentRuns.id }).from(agentRuns).where(eq(agentRuns.trigger, "start_day")).limit(1);
  if (existing.length === 0) return runWorkflow("start_day");
  return null;
}
