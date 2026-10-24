import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";
import type { BriefingAnswers, SceneScript } from "@/nudge/scenes";
import { toRunView, type RunView } from "@/lib/agent-runs";

/** A run with its saved briefing script and answers, for /runs/[id] and Replay. */
export type RunDetail = RunView & {
  sceneScript: SceneScript | null;
  answers: BriefingAnswers | null;
  scriptSource: "model" | "template" | "fallback" | null;
};

export type RunSummary = Pick<RunView, "id" | "type" | "title" | "status" | "startedAt" | "finishedAt"> & {
  agents: string[];
  stepCount: number;
};

/** Runs are scoped to the session that made them (a demo key, or "live"). */
export async function getRunDetail(id: string, sessionKey: string): Promise<RunDetail | null> {
  const run = await db.select().from(agentRuns).where(and(eq(agentRuns.id, id), eq(agentRuns.sessionKey, sessionKey))).get();
  if (!run) return null;
  const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, id)).orderBy(asc(agentSteps.seq));
  return {
    ...toRunView(run, steps),
    sceneScript: run.sceneScript ?? null,
    answers: run.answers ?? null,
    scriptSource: run.scriptSource ?? null,
  };
}

export async function listRuns(sessionKey: string, limit = 50): Promise<RunSummary[]> {
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.sessionKey, sessionKey)).orderBy(desc(agentRuns.startedAt)).limit(limit);
  const steps = runs.length
    ? await db
        .select({ runId: agentSteps.runId, agent: agentSteps.agent })
        .from(agentSteps)
        .where(inArray(agentSteps.runId, runs.map((r) => r.id)))
        .orderBy(asc(agentSteps.seq))
    : [];
  return runs.map((run) => {
    const own = steps.filter((s) => s.runId === run.id);
    const { id, type, title, status, startedAt, finishedAt } = toRunView(run, []);
    return { id, type, title, status, startedAt, finishedAt, agents: [...new Set(own.map((s) => s.agent))], stepCount: own.length };
  });
}
