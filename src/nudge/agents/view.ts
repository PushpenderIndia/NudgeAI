import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, pendingActions } from "@/db/schema";
import type { AgentRun } from "@/db/schema";
import { toRunView, type RunView } from "@/lib/agent-runs";
import type { Briefing } from "@/nudge/briefing";
import type { BriefingAnswers, SceneScript } from "@/nudge/scenes";
import { buildTemplateScript, loadFallbackScript } from "./script";

export type BriefingView = {
  run: RunView;
  briefing: Briefing | null;
  sceneScript: SceneScript | null;
  scriptSource: "model" | "template" | "fallback" | null;
  answers: BriefingAnswers;
  ready: boolean;
};

export async function briefingView(run: AgentRun): Promise<BriefingView> {
  const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, run.id)).orderBy(asc(agentSteps.seq));
  return {
    run: toRunView(run, steps),
    briefing: run.briefing ?? null,
    sceneScript: run.sceneScript ?? null,
    scriptSource: run.scriptSource ?? null,
    answers: run.answers ?? {},
    ready: Boolean(run.briefing && run.sceneScript),
  };
}

/**
 * `?fallback=1` while the run is still working: a usable script right now. With the
 * briefing saved → the template from real data; before that (demo) → the committed
 * fallback script with whatever action ids are already queued. The choice is saved on
 * the run so the pipeline won't overwrite what the client is speaking.
 */
export async function ensureScript(run: AgentRun, opts: { demo: boolean; tz?: string }): Promise<AgentRun> {
  if (run.sceneScript) return run;
  let script: SceneScript | null = null;
  let source: "template" | "fallback" = "template";
  if (run.briefing) script = buildTemplateScript(run.briefing, run.answers ?? undefined, opts.tz);
  else if (opts.demo) {
    const queued = await db.select({ id: pendingActions.id, type: pendingActions.actionType }).from(pendingActions).where(eq(pendingActions.runId, run.id));
    script = loadFallbackScript({
      catchActionId: queued.find((a) => a.type === "transition_ticket")?.id,
      postActionId: queued.find((a) => a.type === "post_slack")?.id,
    });
    source = "fallback";
  }
  if (!script) return run;
  await db.update(agentRuns).set({ sceneScript: script, scriptSource: source }).where(and(eq(agentRuns.id, run.id), isNull(agentRuns.scriptSource)));
  return (await db.select().from(agentRuns).where(eq(agentRuns.id, run.id)).get()) ?? run;
}
