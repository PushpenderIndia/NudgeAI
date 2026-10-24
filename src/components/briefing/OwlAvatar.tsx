"use client";

import { OwlMark } from "@/components/NudgeLogo";
import { usePrefersReducedMotion } from "@/components/today/hooks";
import { cn } from "@/lib/utils";
import type { EngineStatus } from "./engine/useSceneEngine";

export type OwlState = "idle" | "speaking" | "listening" | "thinking";

export function owlStateFor(status: EngineStatus): OwlState {
  return status === "speaking" || status === "listening" || status === "thinking" ? status : "idle";
}

const LABELS: Record<OwlState, string> = {
  idle: "Nudge",
  speaking: "Nudge is speaking",
  listening: "Nudge is listening",
  thinking: "Nudge is thinking",
};

/**
 * The owl with briefing states: beak moves while speaking, slow blink when idle, eyes look up
 * while thinking, a thin ring while listening, amber eyes only when urgent. Motion is dropped
 * under prefers-reduced-motion.
 */
export function OwlAvatar({
  state = "idle",
  urgent = false,
  size = 64,
  className,
}: {
  state?: OwlState;
  urgent?: boolean;
  size?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <span
      role="img"
      aria-label={LABELS[state]}
      data-state={state}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {state === "listening" && (
        <span
          aria-hidden
          className={cn("absolute rounded-full border border-primary/70", !reduced && "owl-listen-ring")}
          style={{ inset: -Math.max(4, size * 0.08) }}
        />
      )}
      <OwlMark
        size={size}
        urgent={urgent}
        blinking={!reduced && (state === "idle" || state === "thinking")}
        speaking={!reduced && state === "speaking"}
        gaze={state === "thinking" ? { x: -1, y: -1.3 } : undefined}
        className="transition-transform duration-300"
      />
    </span>
  );
}
