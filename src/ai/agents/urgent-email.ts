import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { drafts, emails, tasks } from "@/db/schema";
import type { Email } from "@/db/schema";
import { queueAction } from "@/ai/approvals";
import { getRelevantMemories } from "@/ai/memory";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { formatTime } from "@/lib/utils";
import { createRun, describePayload, finishRun, stepper } from "./runs";
import { narrate } from "./narrate";
import { CandidateBook, emailItem, fetchMeetings, fetchMoms, meetingItem, overlap } from "./context";
import { heuristicTriage } from "./plan-day";

/**
 * urgent_email: Courier triages → Historian finds context → Courier drafts a reply
 * (queued for approval, never sent) → Planner adds an urgent task.
 */
export async function runUrgentEmail(runId: string, emailId: string) {
  const email = await db.select().from(emails).where(eq(emails.id, emailId)).get();
  if (!email) throw new Error("That email is no longer in the inbox.");
  const settings = await getSettings();
  const step = stepper(runId);
  const book = new CandidateBook();
  const emailRef = book.add("email:new", emailItem(email, true));

  /* 1. Courier: triage */
  const triage = await step(
    { agent: "Courier", phase: "Triaging new mail", tool: "Email", tier: "fast", input: `${email.fromName}: ${email.subject}` },
    async () => {
      const out = await narrate({
        agent: "Courier",
        phase: "Triaging new mail",
        tier: "fast",
        task: "A new email just arrived. Classify it as urgent, needs_reply or fyi with a one-line reason. Narrate who it's from, what they need and how soon, and that you're asking Historian for context.",
        facts: { from: email.fromName, subject: email.subject, body: email.body, received: formatTime(email.receivedAt) },
        candidates: book.all(),
        extra: { triage: z.enum(["urgent", "needs_reply", "fyi"]).catch("urgent"), reason: z.string().default("") },
        extraHint: '"triage": "urgent" | "needs_reply" | "fyi", "reason": string',
        fallback: () => {
          const t = heuristicTriage(email);
          return {
            narration: `${email.fromName} just wrote about "${email.subject}". ${t.triage === "urgent" ? "It looks urgent" : "It needs a reply"}: ${t.reason.charAt(0).toLowerCase()}${t.reason.slice(1)}`,
            found: [emailRef],
            extra: { triage: t.triage, reason: t.reason },
          };
        },
      });
      await db.update(emails).set({ triage: out.extra.triage, triageReason: out.extra.reason || null }).where(eq(emails.id, email.id));
      return { ...out, result: out.extra, handoffTo: "Historian", handoffSummary: `passing the email from ${email.fromName}` };
    },
    { narration: "I couldn't triage this one cleanly, so I'm treating it as urgent to be safe.", result: { triage: "urgent" as const, reason: "New email." }, handoffTo: "Historian" }
  );

  /* 2. Historian: related context */
  const context = await step(
    { agent: "Historian", phase: "Finding context", tool: "Meetings, Memory", tier: "fast", input: `Past work related to "${email.subject}"` },
    async () => {
      const [meetingsRes, moms, memories, openTasks] = await Promise.all([
        fetchMeetings(),
        fetchMoms(),
        getRelevantMemories(`${email.fromName} ${email.subject} ${email.body}`, 4),
        db.select().from(tasks).where(eq(tasks.status, "todo")),
      ]);
      // Related = the sender was there, or the meeting is about the same thing.
      const senderLast = email.fromName.split(" ").at(-1)?.toLowerCase() ?? "";
      const score = (m: (typeof meetingsRes.rows)[number]) =>
        Number(m.attendees.some((a) => a.toLowerCase().includes(senderLast))) * 2 + overlap(m.title, email.subject).length;
      const related = meetingsRes.rows
        .filter((m) => m.startsAt < new Date() && score(m) > 0)
        .sort((a, b) => score(b) - score(a) || b.startsAt.getTime() - a.startsAt.getTime())
        .slice(0, 3);
      related.forEach((m, i) => book.add(`meeting:${i + 1}`, meetingItem(m)));
      const relatedTasks = openTasks.filter((t) => overlap(t.title, email.subject).length > 0).slice(0, 3);
      relatedTasks.forEach((t, i) => book.add(`task:${i + 1}`, { kind: "task", label: t.title }));
      const facts = {
        email: { from: email.fromName, subject: email.subject },
        relatedMeetings: related.map((m, i) => ({ ref: `meeting:${i + 1}`, title: m.title, when: m.startsAt.toDateString(), minutes: moms.get(m.id)?.summary, decisions: moms.get(m.id)?.decisions })),
        relatedOpenTasks: relatedTasks.map((t, i) => ({ ref: `task:${i + 1}`, title: t.title })),
        memories: memories.map((m) => m.content),
      };
      const out = await narrate({
        agent: "Historian",
        phase: "Finding context",
        tier: "fast",
        task: "Find what the user already knows that bears on this email: earlier meetings, decisions, open tasks and what you remember about the sender. Summarise it in 'context' (two or three short sentences Courier can use when drafting). Narrate the most useful link.",
        facts,
        candidates: book.pick(["meeting:", "task:"]),
        extra: { context: z.string().default("") },
        extraHint: '"context": string',
        fallback: () => ({
          narration: related[0]
            ? `This connects to ${related[0].title}${moms.get(related[0].id)?.decisions[0] ? `, where you agreed to ${moms.get(related[0].id)!.decisions[0].charAt(0).toLowerCase()}${moms.get(related[0].id)!.decisions[0].slice(1)}` : ""}.`
            : `I didn't find earlier meetings about this, but I know a little about ${email.fromName}.`,
          found: [...related.map((_, i) => `meeting:${i + 1}`), ...relatedTasks.map((_, i) => `task:${i + 1}`)],
          extra: { context: [...related.map((m) => moms.get(m.id)?.summary).filter(Boolean), ...memories.map((m) => m.content)].join(" ") },
        }),
      });
      const linked = related.length + relatedTasks.length;
      return { ...out, result: { text: out.extra.context, memories: memories.map((m) => m.content) }, handoffTo: "Courier", handoffSummary: describePayload([[linked, "related item", "related items"], [memories.length, "memory", "memories"]]) };
    },
    { narration: "I couldn't search your history just now, so Courier will draft from the email alone.", result: { text: "", memories: [] as string[] }, handoffTo: "Courier" }
  );

  /* 3. Courier: draft the reply (held for approval) */
  const drafted = await step(
    { agent: "Courier", phase: "Drafting a reply", tool: "Drafts", tier: "heavy", input: "The email, Historian's context and your writing style" },
    async () => {
      const out = await narrate({
        agent: "Courier",
        phase: "Drafting a reply",
        tier: "heavy",
        task: `Draft a reply the user could send, in a ${settings.toneDefault} tone that matches their remembered style. Don't promise anything the context doesn't support. Narrate what the reply says in one sentence and that it's waiting for their OK, not sent.`,
        facts: { email: { from: email.fromName, subject: email.subject, body: email.body }, context: context.text, styleAndPeople: context.memories, signOffName: settings.userName },
        candidates: book.all(),
        extra: { subject: z.string().default(`Re: ${email.subject}`), body: z.string().default("") },
        extraHint: '"subject": string, "body": string',
        maxTokens: 1200,
        fallback: () => ({ narration: "I couldn't write the draft just now, so I've put a reply on your list instead.", found: [], extra: { subject: `Re: ${email.subject}`, body: "" } }),
      });
      if (!out.extra.body.trim()) return { ...out, result: false, handoffTo: "Planner", handoffSummary: "passing the email to add as a task" };
      const content = JSON.stringify({ subject: out.extra.subject, body: out.extra.body });
      const [draft] = await db.insert(drafts).values({ kind: "email_reply", targetType: "email", targetId: email.id, content, tone: settings.toneDefault, runId }).returning({ id: drafts.id });
      await queueAction({
        actionType: "send_email",
        summary: `Reply to ${email.fromName}: ${email.subject}`,
        payload: { emailId: email.id, to: email.fromEmail, subject: out.extra.subject, body: out.extra.body },
        draftId: draft.id,
        runId,
        reason: triage.reason || "Marked urgent by Courier.",
      });
      return {
        ...out,
        foundItems: [{ kind: "draft" as const, label: out.extra.subject, detail: "Waiting for your OK" }],
        result: true,
        handoffTo: "Planner",
        handoffSummary: "passing 1 draft for your OK and the deadline",
      };
    },
    { narration: "I couldn't write the draft this time, so I've put a reply on your list instead.", result: false, handoffTo: "Planner" }
  );

  /* 4. Planner: urgent task */
  await step(
    { agent: "Planner", phase: "Adding a task", tool: "Tasks", tier: "fast", input: "Courier's urgent email" },
    async () => {
      const title = `Reply to ${email.fromName}: ${email.subject}`;
      const out = await narrate({
        agent: "Planner",
        phase: "Adding a task",
        tier: "fast",
        task: "You're adding an urgent task to today's list for this email. Narrate where it goes and why, in one sentence.",
        facts: { task: title, priority: "urgent", draftWaitingForApproval: drafted, triageReason: triage.reason },
        candidates: [],
        extra: {},
        extraHint: "",
        fallback: () => ({ narration: `I've put "${title}" at the top of today's list${drafted ? " so the draft doesn't sit for long" : ""}.`, found: [], extra: {} }),
      });
      const [first] = await db.select({ sortOrder: tasks.sortOrder }).from(tasks).where(eq(tasks.status, "todo")).orderBy(tasks.sortOrder).limit(1);
      await db.insert(tasks).values({ title, priority: "urgent", source: "email", sourceId: email.id, runId, agent: "Planner", sortOrder: (first?.sortOrder ?? 0) - 1 });
      return { ...out, foundItems: [{ kind: "task" as const, label: title, detail: "urgent", urgent: true }], result: null };
    },
    { narration: "I couldn't add the task, so keep an eye on this one.", result: null }
  );

  await logActivity({ action: "Courier handled an urgent email", summary: `${email.fromName}: ${email.subject}`, entityType: "agent_run", entityId: runId });
  await finishRun(runId, drafted ? "waiting_for_user" : "done", `${email.fromName}: ${email.subject}`);
}

/** Picks the newest untriaged unsent email (or a given one) and starts the run in the background. */
export async function startUrgentEmail(emailId?: string) {
  const target: Email | undefined = emailId
    ? await db.select().from(emails).where(eq(emails.id, emailId)).get()
    : await db.select().from(emails).where(and(eq(emails.isSent, false), isNull(emails.triage))).orderBy(desc(emails.receivedAt)).get();
  if (!target) throw new Error("There's no new email to work on.");
  const runId = await createRun("urgent_email", `Urgent email from ${target.fromName}`);
  void runUrgentEmail(runId, target.id).catch(async (error) => {
    console.error("urgent_email failed", error);
    await finishRun(runId, "failed");
  });
  return { runId };
}
