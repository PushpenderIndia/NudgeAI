import { and, eq, max } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";
import type { AgentRun, FoundItem } from "@/db/schema";
import { approveAction, rejectAction } from "@/ai/approvals";
import { beginStep, completeStep, type AgentName, type Tier } from "@/ai/agents/runs";
import { standupToText, type Briefing, type StandupDraft } from "@/nudge/briefing";
import type { BriefingAnswers } from "@/nudge/scenes";
import type { DataSource, Ticket } from "@/nudge/types";
import { applyEditFallback, buildPlan, extraTodayLines, orderForPick, pendingLine, planSentence, standupLines, todayLines } from "./analysis";
import { getSessionAction, updateActionPayload } from "./actions";
import { modelJSON, modelText, VOICE_RULES } from "./model";
import { safeZone, spokenTime } from "./time";

const Via = z.enum(["voice", "click", "text"]);
export const AnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catch"), decision: z.enum(["confirm", "decline"]), via: Via }),
  z.object({ kind: z.literal("pick"), choiceId: z.string().min(1), via: Via }),
  z.object({ kind: z.literal("edit"), instruction: z.string().min(1).max(400) }),
  z.object({ kind: z.literal("done") }),
  z.object({ kind: z.literal("replace"), standup: z.object({ yesterday: z.array(z.string()), today: z.array(z.string()), blockers: z.array(z.string()) }) }),
  z.object({ kind: z.literal("post"), decision: z.enum(["confirm", "decline"]), via: Via }),
]);
export type Answer = z.infer<typeof AnswerSchema>;

type Ctx = { run: AgentRun; briefing: Briefing; answers: BriefingAnswers; ds: DataSource; tz: string };

const approveVia = (via: z.infer<typeof Via>) => (via === "text" ? "click" : via);

/** Appends a narrated step to a finished run; the response doesn't wait out the display pacing. */
async function appendStep(
  runId: string,
  meta: { agent: AgentName; phase: string; tool: string; tier: Tier; input: string },
  out: { narration: string; foundItems?: FoundItem[]; modelUsed: boolean }
) {
  const row = await db.select({ seq: max(agentSteps.seq) }).from(agentSteps).where(eq(agentSteps.runId, runId)).get();
  const step = await beginStep(runId, (row?.seq ?? 0) + 1, { agent: meta.agent, phase: meta.phase, tool: meta.tool, tier: meta.tier, inputSummary: meta.input });
  const done = completeStep(step, { narration: out.narration, foundItems: out.foundItems ?? [], tier: meta.tier, modelUsed: out.modelUsed });
  try {
    after(() => done);
  } catch {
    void done;
  }
}

async function save(ctx: Ctx, patch: { briefing?: Briefing; answers?: BriefingAnswers }) {
  if (patch.briefing) ctx.briefing = patch.briefing;
  if (patch.answers) ctx.answers = patch.answers;
  await db.update(agentRuns).set({ briefing: ctx.briefing, answers: ctx.answers }).where(eq(agentRuns.id, ctx.run.id));
}

/** Keeps the queued Slack post in step with the standup on the page. */
async function syncPost(ctx: Ctx) {
  const action = await getSessionAction(ctx.briefing.standupActionId, ctx.ds.sessionKey);
  if (action?.status === "pending") await updateActionPayload(action.id, { ...action.payload, text: standupToText(ctx.briefing.standup) });
}

function withPendingLine(b: Briefing, declined: boolean): StandupDraft {
  if (!b.mismatch) return b.standup;
  const line = pendingLine(b.mismatch);
  const today = b.standup.today.filter((l) => l !== line);
  return { ...b.standup, today: declined ? [...today, line] : today };
}

export async function loadRun(runId: string, sessionKey: string) {
  return (await db.select().from(agentRuns).where(and(eq(agentRuns.id, runId), eq(agentRuns.sessionKey, sessionKey))).get()) ?? null;
}

export async function handleAnswer(run: AgentRun, answer: Answer, ds: DataSource) {
  if (!run.briefing) return { status: 409, body: { ok: false, message: "The briefing isn't ready yet." } };
  const profile = await ds.memory.profile().catch(() => null);
  const ctx: Ctx = { run, briefing: run.briefing, answers: run.answers ?? {}, ds, tz: safeZone(profile?.timezone) };
  switch (answer.kind) {
    case "catch":
      return { status: 200, body: await answerCatch(ctx, answer) };
    case "pick":
      return answerPick(ctx, answer);
    case "edit":
      return { status: 200, body: await answerEdit(ctx, answer.instruction) };
    case "done":
      return { status: 200, body: await answerDone(ctx) };
    case "replace":
      return { status: 200, body: await answerReplace(ctx, answer.standup) };
    case "post":
      return { status: 200, body: await answerPost(ctx, answer) };
  }
}

async function answerCatch(ctx: Ctx, a: Extract<Answer, { kind: "catch" }>) {
  const m = ctx.briefing.mismatch;
  if (!m) return { ok: false, message: "There's no ticket to move.", standup: ctx.briefing.standup };
  const action = await getSessionAction(m.pendingActionId, ctx.ds.sessionKey);
  let result: { ok: boolean; message: string; undoUntil?: string } = { ok: false, message: "That action no longer exists." };
  if (action && a.decision === "confirm") result = await approveAction(action.id, { via: approveVia(a.via) });
  else if (action && action.status === "pending") result = await rejectAction(action.id);
  else if (action) result = { ok: true, message: "Already handled." };
  const declined = a.decision === "decline" || !result.ok;
  await save(ctx, {
    briefing: { ...ctx.briefing, standup: withPendingLine(ctx.briefing, declined) },
    answers: { ...ctx.answers, catch: { decision: a.decision, via: a.via } },
  });
  await syncPost(ctx);
  await appendStep(
    ctx.run.id,
    { agent: "Tracker", phase: declined ? "Leaving the ticket" : "Moving the ticket", tool: "Jira", tier: "fast", input: `Your answer: ${a.decision} (${a.via})` },
    { narration: declined ? `Left ${m.ticket.key} as ${m.ticket.status}; the standup notes it as pending.` : `Approved by ${approveVia(a.via)}: ${m.ticket.key} moves to ${m.suggestedStatus}.`, modelUsed: false, foundItems: [{ kind: "jira", label: `${m.ticket.key} ${m.ticket.title}`, detail: declined ? m.ticket.status : `${m.ticket.status} → ${m.suggestedStatus}`, href: m.ticket.url }] }
  );
  return { ok: result.ok, message: result.message, ...(result.undoUntil ? { undoUntil: result.undoUntil } : {}), standup: ctx.briefing.standup };
}

async function answerPick(ctx: Ctx, a: Extract<Answer, { kind: "pick" }>) {
  const b = ctx.briefing;
  const chosen = b.picks.find((p) => p.id === a.choiceId);
  if (!chosen) return { status: 400, body: { ok: false, message: `${a.choiceId} isn't one of today's picks.` } };
  const plan = buildPlan(b.events, b.gaps, orderForPick(b.picks, chosen.id));
  const pool = new Map<string, Ticket>([...b.picks.map((p) => [p.id, p.ticket] as const), ...b.todo.map((t) => [t.key, t] as const)]);
  const todo = [...pool.values()].filter((t) => t.key !== chosen.id);
  const declined = ctx.answers.catch?.decision === "decline";
  const standup: StandupDraft = { ...b.standup, today: todayLines(plan, b.picks, b.mismatch, declined, extraTodayLines(b.standup.today, b.picks, b.mismatch)) };
  const fallback = () => planSentence(plan, chosen.id, ctx.tz, b.picks);
  const speech = await modelText(
    {
      tier: "fast",
      maxTokens: 120,
      system: `You are Planner inside Nudge, speaking to the developer. In 2 or 3 short sentences, say where their chosen task fits in today's calendar and what comes after.\n${VOICE_RULES}\nReply with the spoken line only.`,
      user: JSON.stringify({
        chosen: { key: chosen.id, title: chosen.ticket.title },
        plan: plan.filter((p) => p.kind !== "free").map((p) => ({ what: p.ticketKey ? `${p.ticketKey} ${p.title}` : p.title, start: spokenTime(p.start, ctx.tz), end: spokenTime(p.end, ctx.tz) })),
        example: fallback(),
      }),
    },
    fallback
  );
  const line = speech.value.replace(/^["']|["']$/g, "");
  await save(ctx, {
    briefing: { ...b, plan, todo, standup },
    answers: { ...ctx.answers, pick: { choiceId: chosen.id, via: a.via }, planSpeech: line },
  });
  await syncPost(ctx);
  await appendStep(
    ctx.run.id,
    { agent: "Planner", phase: "Planning around your pick", tool: "Calendar", tier: "fast", input: `You picked ${chosen.id} (${a.via})` },
    { narration: `${chosen.id} first; ${plan.filter((p) => p.kind === "task").length} tasks slotted around ${b.events.length} meetings.`, modelUsed: speech.modelUsed, foundItems: [{ kind: "jira", label: `${chosen.id} ${chosen.ticket.title}`, detail: chosen.reason, href: chosen.ticket.url }] }
  );
  return { status: 200, body: { plan, speech: line, todo, standup } };
}

const StandupSchema = z.object({ yesterday: z.array(z.string()), today: z.array(z.string()), blockers: z.array(z.string()).default([]) });

async function answerEdit(ctx: Ctx, instruction: string) {
  const before = ctx.briefing.standup;
  const redraft = await modelJSON<StandupDraft>(
    {
      tier: "heavy",
      system: `You are Reporter inside Nudge. Apply the developer's requested change to their standup and return the full standup {yesterday, today, blockers} as short bullet lines. Change only what they asked; keep every other line exactly as it is.\n${VOICE_RULES}`,
      user: JSON.stringify({ standup: before, change: instruction }),
      schema: StandupSchema,
    },
    () => applyEditFallback(before, instruction)
  );
  const standup = redraft.value;
  const beforeLines = standupLines(before);
  const afterLines = standupLines(standup);
  const removed = beforeLines.filter((l) => !afterLines.includes(l) && l !== "None");
  const added = afterLines.filter((l) => !beforeLines.includes(l) && l !== "None");
  const quote = (l: string) => (l.length > 60 ? `${l.slice(0, 57)}…` : l);
  const speech = !removed.length && !added.length
    ? "I couldn't tell what to change there. Could you say it another way?"
    : `${removed.length && added.length ? `Changed it to "${quote(added[0])}".` : removed.length ? `Removed "${quote(removed[0])}".` : `Added "${quote(added[0])}".`} Anything else?`;
  await save(ctx, {
    briefing: { ...ctx.briefing, standup },
    answers: { ...ctx.answers, standupEdits: [...(ctx.answers.standupEdits ?? []), { instruction, before: beforeLines, after: afterLines }] },
  });
  await syncPost(ctx);
  await appendStep(
    ctx.run.id,
    { agent: "Reporter", phase: "Redrafting your standup", tool: "Slack", tier: "heavy", input: `"${instruction}"` },
    { narration: `Redrafted the standup: ${removed.length} line${removed.length === 1 ? "" : "s"} out, ${added.length} in.`, modelUsed: redraft.modelUsed }
  );
  return { before: beforeLines, after: afterLines, standup, speech };
}

async function answerDone(ctx: Ctx) {
  await save(ctx, { answers: { ...ctx.answers, standupFinal: standupLines(ctx.briefing.standup) } });
  await syncPost(ctx);
  return { standup: ctx.briefing.standup };
}

/** The text editor's version of the standup (offered after three spoken edits): saved as-is, no model call. */
async function answerReplace(ctx: Ctx, standup: StandupDraft) {
  const before = standupLines(ctx.briefing.standup);
  const after = standupLines(standup);
  await save(ctx, {
    briefing: { ...ctx.briefing, standup },
    answers: { ...ctx.answers, standupEdits: [...(ctx.answers.standupEdits ?? []), { instruction: "Edited in the text editor", before, after }], standupFinal: after },
  });
  await syncPost(ctx);
  return { before, after, standup };
}

async function answerPost(ctx: Ctx, a: Extract<Answer, { kind: "post" }>) {
  const action = await getSessionAction(ctx.briefing.standupActionId, ctx.ds.sessionKey);
  const answers = { ...ctx.answers, post: { decision: a.decision, via: a.via }, standupFinal: ctx.answers.standupFinal ?? standupLines(ctx.briefing.standup) };
  if (!action) {
    await save(ctx, { answers });
    return { ok: false, message: "The standup post is no longer waiting." };
  }
  await syncPost(ctx);
  const result = a.decision === "confirm" ? await approveAction(action.id, { via: approveVia(a.via) }) : { ok: true, message: "Kept as a draft." };
  await save(ctx, { answers });
  await appendStep(
    ctx.run.id,
    { agent: "Reporter", phase: a.decision === "confirm" ? "Posting your standup" : "Keeping the draft", tool: "Slack", tier: "fast", input: `Your answer: ${a.decision} (${a.via})` },
    { narration: a.decision === "confirm" ? (result.ok ? `Approved by ${approveVia(a.via)}: standup goes to #team-standup.` : `Couldn't post: ${result.message}`) : "Kept the standup as a draft on the page.", modelUsed: false }
  );
  return { ok: result.ok, message: result.message, ...("undoUntil" in result && result.undoUntil ? { undoUntil: result.undoUntil } : {}) };
}
