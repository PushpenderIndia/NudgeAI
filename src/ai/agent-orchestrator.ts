import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, meetingPrep, meetings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { completeText, hasApiKey, resolveModel } from "@/ai/client";
import { startPlanDay } from "@/ai/agents/plan-day";
import { startUrgentEmail } from "@/ai/agents/urgent-email";
import { startMeetingEnded } from "@/ai/agents/meeting-ended";

export const AGENTS = [
  { name: "Scribe", role: "Meeting notes and actions", tool: "meetings" },
  { name: "Courier", role: "Email triage and drafts", tool: "email" },
  { name: "Tracker", role: "GitHub and Jira updates", tool: "github / Jira" },
  { name: "Planner", role: "Tasks and reminders", tool: "tasks" },
  { name: "Historian", role: "Context from past work", tool: "search" },
  { name: "Reporter", role: "Weekly reporting", tool: "activity" },
] as const;

// Narrated workflows (plan_day, urgent_email, meeting_ended) live in ./agents;
// start_day only prepares meeting briefs for the Meetings page.
type Workflow = "start_day";
const WORKFLOW_TITLES: Record<Workflow, string> = {
  start_day: "Prepare today's meeting briefs",
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
    const upcoming = await db.select().from(meetings).orderBy(asc(meetings.startsAt)).limit(3);
    let seq = 1;
    for (const meeting of upcoming) {
      await prepareMeeting(runId, meeting, seq);
      seq += 2;
    }
    await logActivity({ action: "Nudge prepared meeting briefs", summary: `${upcoming.length} meeting briefs are ready`, entityType: "agent_run", entityId: runId });
    await finishRun(runId, "done");
    return { runId };
  } catch (error) {
    await finishRun(runId, "failed");
    throw error;
  }
}

export async function startWorkflow(workflow: Workflow | "plan_day" | "urgent_email" | "meeting_ended"): Promise<{ runId: string }> {
  if (workflow === "plan_day") return startPlanDay();
  if (workflow === "urgent_email") return startUrgentEmail();
  if (workflow === "meeting_ended") return startMeetingEnded();
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
