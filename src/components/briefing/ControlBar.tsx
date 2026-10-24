"use client";

import { useEffect, useRef } from "react";
import { ChevronsRight, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";
import { VOICE_RATES } from "@/nudge/voice/prefs";
import { cn } from "@/lib/utils";
import type { SceneEngine } from "./engine/useSceneEngine";

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Space = pause/resume, Esc = skip all, Enter = the default button. Ignored while typing. */
export function useBriefingKeys(engine: SceneEngine, enabled = true) {
  const ref = useRef(engine);
  useEffect(() => {
    ref.current = engine;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const e = ref.current;
      if (e.status === "idle" || e.status === "done") return;
      const onButton = event.target instanceof HTMLElement && !!event.target.closest("button, a");
      if (event.key === " " && !onButton) {
        event.preventDefault();
        e.togglePause();
      } else if (event.key === "Escape") {
        e.skipAll();
      } else if (event.key === "Enter" && !onButton && e.defaultOptionId && e.status === "waiting") {
        event.preventDefault();
        e.respond({ kind: "click", optionId: e.defaultOptionId });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

function BarButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:pointer-events-none disabled:opacity-40",
        active && "text-fg"
      )}
    >
      {children}
    </button>
  );
}

/** Floating playback controls for the briefing (bottom centre by default). */
export function ControlBar({
  engine,
  floating = true,
  keyboard = true,
  className,
}: {
  engine: SceneEngine;
  floating?: boolean;
  /** Registers the Space / Esc / Enter shortcuts. */
  keyboard?: boolean;
  className?: string;
}) {
  useBriefingKeys(engine, keyboard);
  const running = engine.status !== "idle" && engine.status !== "done";
  const paused = engine.status === "paused";
  return (
    <div
      role="toolbar"
      aria-label="Briefing controls"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border bg-surface/95 px-1.5 py-1 shadow-sm backdrop-blur",
        floating && "fixed bottom-6 left-1/2 z-40 -translate-x-1/2",
        className
      )}
    >
      <BarButton label={paused ? "Resume" : "Pause"} onClick={engine.togglePause} disabled={!running}>
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </BarButton>
      <BarButton label={engine.muted ? "Unmute" : "Mute"} onClick={engine.toggleMute} active={engine.muted}>
        {engine.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </BarButton>
      <BarButton label="Skip scene" onClick={engine.skipScene} disabled={!running}>
        <SkipForward size={15} />
      </BarButton>
      <BarButton label="Skip all" onClick={engine.skipAll} disabled={!running}>
        <ChevronsRight size={16} />
      </BarButton>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <div role="radiogroup" aria-label="Speed" className="flex items-center">
        {VOICE_RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            role="radio"
            aria-checked={engine.speed === rate}
            onClick={() => engine.setSpeed(rate)}
            className={cn(
              "h-7 cursor-pointer rounded-full px-2 text-[11px] font-medium tabular-nums text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft",
              engine.speed === rate && "bg-surface-2 text-fg"
            )}
          >
            {rate}×
          </button>
        ))}
      </div>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <BarButton label="Replay" onClick={() => engine.replay()} disabled={engine.status !== "done"}>
        <RotateCcw size={14} />
      </BarButton>
    </div>
  );
}
