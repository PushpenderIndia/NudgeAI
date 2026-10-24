"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isFinished, toRunView, type RunView, type StepView } from "@/lib/agent-runs";

/**
 * Follows a run over SSE. Finished runs are returned as-is (their steps are stored),
 * so Replay and reloads never reopen the stream or call the model again.
 */
export function useRunStream(runId: string | null, initial: RunView | null) {
  const [streamed, setStreamed] = useState<RunView | null>(null);
  const seed = initial && initial.id === runId ? initial : null;
  const seedFinished = isFinished(seed);

  useEffect(() => {
    if (!runId || seedFinished) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let attempts = 0;
    const open = () => {
      source = new EventSource(`/api/agents/stream?runId=${runId}`);
      source.onmessage = (event) => {
        attempts = 0;
        const data = JSON.parse(event.data) as { runs?: Record<string, unknown>[]; steps?: Record<string, unknown>[] };
        const row = data.runs?.[0];
        if (!row) return;
        const view = toRunView(row, data.steps ?? []);
        finished = isFinished(view);
        setStreamed(view);
      };
      source.addEventListener("end", () => {
        finished = true;
        source?.close();
      });
      source.onerror = () => {
        source?.close();
        if (!finished && attempts++ < 5) retry = setTimeout(open, 1500);
      };
    };
    open();
    return () => {
      finished = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [runId, seedFinished]);

  const live = streamed && streamed.id === runId ? streamed : null;
  if (!live) return seed;
  if (!seed) return live;
  // Prefer whichever has progressed further (a refreshed page may beat the stream).
  return isFinished(seed) && !isFinished(live) ? seed : live.steps.length >= seed.steps.length ? live : seed;
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

export type Playback = {
  /** Index of the step being revealed; earlier steps are fully shown. */
  index: number;
  /** Characters of the current step's narration revealed so far. */
  chars: number;
  /** Found items of the current step revealed so far. */
  items: number;
  /** True once every step is revealed and the run has finished. */
  complete: boolean;
};

const INLINE_ITEMS = 4;

/**
 * Reveals steps one after another with a quick typing effect, whether they are
 * arriving live or replayed from storage. Pacing keeps a six-step plan around
 * 15–20 seconds; reduced motion shows each step whole as soon as it's ready.
 */
export function usePlayback(steps: StepView[], runFinished: boolean, reduced: boolean): Playback {
  const [state, setState] = useState({ index: 0, chars: 0, items: 0, stage: "typing" as "typing" | "items" | "pause" });
  const step = steps[state.index];
  const ready = Boolean(step && step.status !== "running");
  const complete = runFinished && state.index >= steps.length;

  useEffect(() => {
    if (!step || !ready) return;
    const text = step.narration;
    const itemCount = Math.min(step.foundItems.length, INLINE_ITEMS);
    let timer: ReturnType<typeof setTimeout>;
    if (reduced) {
      timer = setTimeout(() => setState({ index: state.index + 1, chars: 0, items: 0, stage: "typing" }), 300);
      return () => clearTimeout(timer);
    }
    if (state.stage === "typing") {
      // Whole narration in roughly 0.8–1.6s, a few characters per frame.
      const total = Math.min(1600, Math.max(800, text.length * 11));
      const per = Math.max(1, Math.ceil(text.length / (total / 28)));
      timer = state.chars >= text.length
        ? setTimeout(() => setState((s) => ({ ...s, stage: "items" })), 120)
        : setTimeout(() => setState((s) => ({ ...s, chars: Math.min(text.length, s.chars + per) })), 28);
    } else if (state.stage === "items") {
      timer = state.items >= itemCount
        ? setTimeout(() => setState((s) => ({ ...s, stage: "pause" })), 80)
        : setTimeout(() => setState((s) => ({ ...s, items: s.items + 1 })), 130);
    } else {
      timer = setTimeout(() => setState({ index: state.index + 1, chars: 0, items: 0, stage: "typing" }), 650);
    }
    return () => clearTimeout(timer);
  }, [step, ready, reduced, state]);

  if (reduced && step && ready) return { index: state.index, chars: step.narration.length, items: step.foundItems.length, complete };
  return { index: state.index, chars: state.chars, items: state.items, complete };
}
