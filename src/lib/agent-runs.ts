import type { AgentRun, AgentStep, FoundItem } from "@/db/schema";

/** Client-safe shapes for narrated agent runs (dates as ISO strings). */
export type StepView = {
  id: string;
  seq: number;
  agent: string;
  phase: string;
  tool: string;
  model: string;
  modelTier: "fast" | "heavy" | "none";
  narration: string;
  foundItems: FoundItem[];
  handoffTo: string | null;
  handoffSummary: string | null;
  status: "running" | "done" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunView = {
  id: string;
  type: string;
  title: string;
  status: "running" | "waiting_for_user" | "done" | "failed";
  summary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: StepView[];
};

/** How many steps each narrated workflow takes, for "Step 3 of 6". */
export const RUN_STEP_COUNT: Record<string, number> = { plan_day: 8, urgent_email: 4, meeting_ended: 3, meeting_prep: 3, weekly_update: 2 };

/** What a run is about, for "Courier is working on a new urgent email…". */
export const RUN_SUBJECT: Record<string, string> = {
  plan_day: "your plan",
  urgent_email: "a new urgent email",
  meeting_ended: "the meeting that just ended",
  meeting_prep: "your meeting prep",
  weekly_update: "your weekly update",
};

/** One line for a finished run in the State C banner. */
export const RUN_DONE: Record<string, string> = {
  plan_day: "Your plan is updated.",
  urgent_email: "Courier handled the new email.",
  meeting_ended: "Scribe wrote up the meeting.",
  meeting_prep: "Your meeting prep is ready.",
  weekly_update: "Your weekly update is drafted.",
};

type RawDate = Date | string | number | null | undefined;
const iso = (d: RawDate) => (d ? new Date(d).toISOString() : null);

/** Works for rows straight from the DB and for JSON from the SSE stream. */
export function toStepView(s: AgentStep | Record<string, unknown>): StepView {
  const r = s as AgentStep;
  return {
    id: r.id,
    seq: r.seq,
    agent: r.agent,
    phase: r.action,
    tool: r.tool,
    model: r.model,
    modelTier: (r.modelTier ?? "fast") as StepView["modelTier"],
    narration: r.narration ?? "",
    foundItems: (r.foundItems ?? []) as FoundItem[],
    handoffTo: r.handoffTo ?? null,
    handoffSummary: r.handoffSummary ?? null,
    status: r.status,
    startedAt: iso(r.startedAt),
    finishedAt: iso(r.finishedAt),
  };
}

export function toRunView(run: AgentRun | Record<string, unknown>, steps: (AgentStep | Record<string, unknown>)[]): RunView {
  const r = run as AgentRun;
  return {
    id: r.id,
    type: r.trigger,
    title: r.title,
    status: r.status,
    summary: r.summary ?? null,
    startedAt: iso(r.startedAt),
    finishedAt: iso(r.finishedAt),
    steps: steps.map(toStepView).sort((a, b) => a.seq - b.seq),
  };
}

export const isFinished = (run: Pick<RunView, "status"> | null | undefined) => Boolean(run && run.status !== "running");

export function formatDuration(from: string | null, to: string | null) {
  if (!from) return "";
  const ms = Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  return ms < 60000 ? `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/** "Nemotron Super · fast tier", or an honest note when no model was called. */
export function modelLabel(step: Pick<StepView, "model" | "modelTier">) {
  if (step.modelTier === "none") return "No model call · summarised from data";
  const id = step.model;
  const family = /ultra/i.test(id) ? "Nemotron Ultra" : /super/i.test(id) ? "Nemotron Super" : /nano/i.test(id) ? "Nemotron Nano" : id;
  return `${family} · ${step.modelTier === "heavy" ? "heavy" : "fast"} tier`;
}
