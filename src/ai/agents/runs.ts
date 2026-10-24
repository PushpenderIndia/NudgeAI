import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";
import type { AgentRunStatus, AgentRunType, FoundItem } from "@/db/schema";
import { resolveModel } from "@/ai/client";

export type Tier = "fast" | "heavy";

/** The specialist agents and the tool each one mostly works with. */
export const AGENT_ROSTER = {
  Nudge: "Orchestrator",
  Historian: "Context from past work",
  Scribe: "Meeting notes and actions",
  Courier: "Email triage and drafts",
  Tracker: "GitHub and Jira updates",
  Planner: "Tasks and reminders",
  Reporter: "Daily and weekly updates",
} as const;
export type AgentName = keyof typeof AGENT_ROSTER;

// Keeps each step on screen long enough to follow, even when the work is instant.
const MIN_STEP_MS = 1200;

export async function createRun(type: AgentRunType, title: string, sessionKey?: string) {
  const [run] = await db.insert(agentRuns).values({ trigger: type, title, status: "running", ...(sessionKey ? { sessionKey } : {}) }).returning({ id: agentRuns.id });
  return run.id;
}

export async function finishRun(runId: string, status: Exclude<AgentRunStatus, "running">, summary?: string) {
  await db.update(agentRuns).set({ status, summary, finishedAt: new Date() }).where(eq(agentRuns.id, runId));
}

export async function beginStep(
  runId: string,
  seq: number,
  input: { agent: AgentName; phase: string; tool: string; tier: Tier; inputSummary: string }
) {
  const [row] = await db.insert(agentSteps).values({
    runId,
    seq,
    agent: input.agent,
    action: input.phase,
    tool: input.tool,
    model: resolveModel(input.tier),
    modelTier: input.tier,
    inputSummary: input.inputSummary,
    outputSummary: "",
    status: "running",
    startedAt: new Date(),
  }).returning({ id: agentSteps.id, startedAt: agentSteps.startedAt });
  return { id: row.id, startedAt: row.startedAt ?? new Date() };
}

export async function completeStep(
  step: { id: string; startedAt: Date },
  input: {
    narration: string;
    foundItems: FoundItem[];
    tier: Tier;
    modelUsed: boolean;
    status?: "done" | "failed";
    handoffTo?: AgentName;
    handoffSummary?: string;
  }
) {
  const elapsed = Date.now() - step.startedAt.getTime();
  if (elapsed < MIN_STEP_MS) await new Promise((resolve) => setTimeout(resolve, MIN_STEP_MS - elapsed));
  await db.update(agentSteps).set({
    narration: input.narration,
    outputSummary: input.narration,
    foundItems: input.foundItems,
    model: input.modelUsed ? resolveModel(input.tier) : "No model call",
    modelTier: input.modelUsed ? input.tier : "none",
    status: input.status ?? "done",
    handoffTo: input.handoffTo ?? null,
    handoffSummary: input.handoffSummary ?? null,
    finishedAt: new Date(),
  }).where(eq(agentSteps.id, step.id));
}

type StepMeta = { agent: AgentName; phase: string; tool: string; tier: Tier; input: string };
type StepOutcome<T> = {
  narration: string;
  foundItems: FoundItem[];
  modelUsed: boolean;
  handoffTo?: AgentName;
  handoffSummary?: string;
  result: T;
};

/**
 * Returns a step runner for one run. Each step is persisted as running, then
 * completed with its narration; an unexpected error is narrated honestly and
 * the run carries on with the fallback result.
 */
export function stepper(runId: string) {
  let seq = 0;
  return async function step<T>(
    meta: StepMeta,
    work: () => Promise<StepOutcome<T>>,
    onError: { narration: string; result: T; handoffTo?: AgentName }
  ): Promise<T> {
    const record = await beginStep(runId, ++seq, { agent: meta.agent, phase: meta.phase, tool: meta.tool, tier: meta.tier, inputSummary: meta.input });
    try {
      const out = await work();
      await completeStep(record, { ...out, tier: meta.tier });
      return out.result;
    } catch (error) {
      console.error(`${meta.agent} step failed`, error);
      await completeStep(record, {
        narration: onError.narration,
        foundItems: [],
        tier: meta.tier,
        modelUsed: false,
        status: "failed",
        handoffTo: onError.handoffTo,
        handoffSummary: onError.handoffTo ? "passing on what I have so far" : undefined,
      });
      return onError.result;
    }
  };
}

/** "3 insights and 1 open item" — handoff text built from the payload actually passed on. */
export function describePayload(counts: [count: number, singular: string, plural: string][]) {
  const parts = counts
    .filter(([n]) => n > 0)
    .map(([n, singular, plural]) => `${n} ${n === 1 ? singular : plural}`);
  if (parts.length === 0) return "nothing new to pass on";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `passing ${list}`;
}
