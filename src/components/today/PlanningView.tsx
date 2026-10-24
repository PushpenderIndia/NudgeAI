"use client";

import { useEffect, useEffectEvent } from "react";
import { ArrowRight } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { RUN_STEP_COUNT, isFinished, type RunView } from "@/lib/agent-runs";
import { AgentIcon } from "./AgentIcon";
import { StepTimeline } from "./StepTimeline";
import { usePlayback, usePrefersReducedMotion } from "./hooks";

/**
 * State A: the owl, "Let me plan your day for you.", the agent that's working now,
 * and the narrated steps as they arrive (or as they replay from storage).
 */
export function PlanningView({ run, onSkip, onComplete }: { run: RunView | null; onSkip: () => void; onComplete: () => void }) {
  const reduced = usePrefersReducedMotion();
  const steps = run?.steps ?? [];
  const playback = usePlayback(steps, isFinished(run), reduced);
  const total = Math.max(RUN_STEP_COUNT[run?.type ?? "plan_day"] ?? 6, steps.length);
  const current = steps[playback.index];
  const urgent = steps.slice(0, playback.index + 1).some((s) => s.foundItems.some((f) => f.urgent));
  const failed = run?.status === "failed" && steps.length === 0;

  const finish = useEffectEvent(onComplete);
  useEffect(() => {
    if (!playback.complete) return;
    const timer = setTimeout(() => finish(), reduced ? 200 : 900);
    return () => clearTimeout(timer);
  }, [playback.complete, reduced]);

  const agent = current?.agent ?? (playback.complete ? "Nudge" : steps.length ? steps.at(-1)!.agent : "Nudge");
  const status = playback.complete
    ? "Your plan is ready."
    : failed
      ? "I couldn't finish planning this time."
      : current
        ? `${agent} is working…`
        : "Getting started…";

  return (
    <section className="mx-auto w-full max-w-[720px] pb-10 pt-4 md:pt-8">
      <div className="flex flex-col items-center text-center">
        <OwlMark size={88} blinking={!playback.complete} urgent={urgent} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight md:text-[1.7rem]">Let me plan your day for you.</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted" aria-live="polite">
          {current && !playback.complete && <AgentIcon agent={agent} state="working" size={22} />}
          <span>{status}</span>
        </p>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted">
          <span>Step {Math.min(playback.index + 1, total)} of {total}</span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <button type="button" onClick={onSkip} className="inline-flex items-center gap-1 text-primary-soft hover:underline">
            Skip to my plan <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="mt-10 border-t border-border pt-8">
        {steps.length === 0 ? (
          <p className="text-center text-sm text-muted animate-agent-pulse">{failed ? "Something went wrong before the first step. Try “Plan my day again”." : "Nudge is handing off to Historian…"}</p>
        ) : (
          <StepTimeline steps={steps} playback={playback} />
        )}
      </div>
    </section>
  );
}
