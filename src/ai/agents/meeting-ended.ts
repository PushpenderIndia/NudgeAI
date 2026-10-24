import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { drafts, meetings, tasks } from "@/db/schema";
import { MomSchema, type Mom } from "@/skills/meeting-to-mom";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { createRun, describePayload, finishRun, stepper } from "./runs";
import { listNames, narrate } from "./narrate";
import { dayBounds } from "./context";

/**
 * meeting_ended: Scribe reads the transcript → Scribe writes the minutes →
 * Planner adds the user's action items to today's list.
 */
export async function runMeetingEnded(runId: string, meetingId: string) {
  const meeting = await db.select().from(meetings).where(eq(meetings.id, meetingId)).get();
  if (!meeting?.transcript) throw new Error("That meeting has no transcript.");
  const transcript = meeting.transcript;
  const settings = await getSettings();
  const firstName = settings.userName.split(" ")[0].toLowerCase();
  const step = stepper(runId);
  const lines = transcript.split("\n").filter(Boolean);
  const speakers = [...new Set(lines.map((l) => l.split(":")[0]).filter((s) => s.length < 30))];

  /* 1. Scribe: read the transcript */
  await step(
    { agent: "Scribe", phase: "Reading the transcript", tool: "Teams", tier: "fast", input: meeting.title },
    async () => {
      const out = await narrate({
        agent: "Scribe",
        phase: "Reading the transcript",
        tier: "fast",
        task: "The meeting just ended. Narrate which meeting, who spoke, and the main thread of the conversation in one or two sentences, then say you're writing the minutes.",
        facts: { title: meeting.title, attendees: meeting.attendees, speakers, lineCount: lines.length, transcript: transcript.slice(0, 2500) },
        candidates: [{ ref: "meeting", item: { kind: "meeting", label: meeting.title, detail: `${speakers.length} speakers`, href: "/meetings" } }],
        extra: {},
        extraHint: "",
        fallback: () => ({
          narration: `${meeting.title} just ended. I've read the transcript: ${lines.length} lines from ${listNames(speakers)}. Writing the minutes now.`,
          found: ["meeting"],
          extra: {},
        }),
      });
      return { ...out, result: null, handoffTo: "Scribe", handoffSummary: `passing ${lines.length} transcript lines` };
    },
    { narration: "I had trouble reading the transcript, but I'll try the minutes anyway.", result: null, handoffTo: "Scribe" }
  );

  /* 2. Scribe: minutes (stored as a draft, nothing is sent) */
  const mom = await step(
    { agent: "Scribe", phase: "Writing minutes", tool: "Drafts", tier: "heavy", input: "Transcript and attendees" },
    async () => {
      const out = await narrate({
        agent: "Scribe",
        phase: "Writing minutes",
        tier: "heavy",
        task: "Write the minutes: a 2-3 sentence summary, the decisions actually made, the key discussion points, and action items with a real attendee as owner and a due date or timeframe. Never invent decisions. Narrate the main decision and how many action items there are.",
        facts: { title: meeting.title, attendees: meeting.attendees, transcript },
        candidates: [],
        extra: MomSchema.shape,
        extraHint: '"summary": string, "decisions": string[], "discussionPoints": string[], "actionItems": [{ "title": string, "owner": string, "due": string }]',
        maxTokens: 1800,
        fallback: () => ({ narration: "I couldn't write the minutes just now. The transcript is saved, so you can ask me again from the Meetings page.", found: [], extra: { summary: "", decisions: [], discussionPoints: [], actionItems: [] } }),
      });
      const minutes: Mom = { summary: out.extra.summary, decisions: out.extra.decisions, discussionPoints: out.extra.discussionPoints, actionItems: out.extra.actionItems };
      if (!minutes.summary) return { ...out, result: null as Mom | null, handoffTo: "Planner", handoffSummary: "nothing new to pass on" };
      await db.insert(drafts).values({ kind: "mom", targetType: "meeting", targetId: meeting.id, content: JSON.stringify(minutes), status: "draft", runId });
      await db.update(meetings).set({ hasMom: true }).where(eq(meetings.id, meeting.id));
      return {
        ...out,
        foundItems: [
          ...minutes.decisions.slice(0, 2).map((d) => ({ kind: "decision" as const, label: d, href: "/meetings" })),
          ...minutes.actionItems.slice(0, 4).map((a) => ({ kind: "action_item" as const, label: a.title, detail: `${a.owner} · ${a.due}` })),
        ],
        result: minutes as Mom | null,
        handoffTo: "Planner",
        handoffSummary: describePayload([[minutes.actionItems.length, "action item", "action items"], [minutes.decisions.length, "decision", "decisions"]]),
      };
    },
    { narration: "I couldn't finish the minutes this time.", result: null as Mom | null, handoffTo: "Planner" }
  );

  /* 3. Planner: the user's action items become tasks */
  const mine = (mom?.actionItems ?? []).filter((a) => a.owner.toLowerCase().includes(firstName));
  await step(
    { agent: "Planner", phase: "Adding action items", tool: "Tasks", tier: "fast", input: `${mine.length} action items owned by you` },
    async () => {
      const out = await narrate({
        agent: "Planner",
        phase: "Adding action items",
        tier: "fast",
        task: "You're adding the user's own action items from these minutes to their task list (other people's items stay in the minutes). Narrate what you added and anything due soon.",
        facts: { meeting: meeting.title, yourItems: mine, othersItems: (mom?.actionItems ?? []).filter((a) => !mine.includes(a)) },
        candidates: [],
        extra: {},
        extraHint: "",
        fallback: () => ({
          narration: !mom
            ? "There are no minutes to work from yet, so your list stays as it is."
            : mine.length
              ? `I've added ${mine.length} of your action item${mine.length === 1 ? "" : "s"} to today's list: ${listNames(mine.map((a) => a.title), 2)}.`
              : "None of the action items are yours, so your list stays as it is.",
          found: [],
          extra: {},
        }),
      });
      for (const item of mine) {
        const urgent = /today|asap|eod/i.test(item.due);
        await db.insert(tasks).values({ title: item.title, priority: urgent ? "urgent" : "today", source: "meeting", sourceId: meeting.id, runId, agent: "Planner", sortOrder: urgent ? -1 : 50 });
      }
      return { ...out, foundItems: mine.map((a) => ({ kind: "task" as const, label: a.title, detail: a.due })), result: null };
    },
    { narration: "I couldn't add the action items, but they're in the minutes.", result: null }
  );

  await logActivity({ action: "Scribe wrote meeting notes", summary: `Minutes for ${meeting.title}`, entityType: "agent_run", entityId: runId });
  await finishRun(runId, "done", meeting.title);
}

/** The meeting that most plausibly just ended: today's earliest one with a transcript and no minutes. */
export async function startMeetingEnded(meetingId?: string) {
  const { dayStart } = dayBounds();
  const target = meetingId
    ? await db.select().from(meetings).where(eq(meetings.id, meetingId)).get()
    : (await db.select().from(meetings).where(and(gte(meetings.startsAt, dayStart), isNotNull(meetings.transcript), eq(meetings.hasMom, false))).orderBy(asc(meetings.startsAt)).get())
      ?? (await db.select().from(meetings).where(and(isNotNull(meetings.transcript), eq(meetings.hasMom, false))).orderBy(asc(meetings.startsAt)).get());
  if (!target) throw new Error("Every meeting with a transcript already has minutes.");
  const runId = await createRun("meeting_ended", `Meeting ended: ${target.title}`);
  void runMeetingEnded(runId, target.id).catch(async (error) => {
    console.error("meeting_ended failed", error);
    await finishRun(runId, "failed");
  });
  return { runId };
}
