"use client";

import { useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import type { Interaction } from "@/nudge/scenes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { interactionOptions } from "./engine/intents";
import type { SceneEngine } from "./engine/useSceneEngine";

const HINTS: Record<Interaction["type"], string[]> = {
  confirm: ["yes", "not now"],
  choice: ["the first one"],
  edit: ["remove the meeting point", "looks good"],
};

/**
 * Answer controls for the open interaction: buttons (always), an "or type…" box and a mic
 * with hint chips. Typed text, chips and speech all go through the same intent parser.
 */
export function InteractionPanel({
  engine,
  interaction = engine.interaction,
  hints,
  className,
}: {
  engine: SceneEngine;
  interaction?: Interaction | null;
  /** Overrides the default hint chips. */
  hints?: string[];
  className?: string;
}) {
  const [text, setText] = useState("");
  if (!interaction) return null;

  const busy = engine.status === "thinking" || engine.replaying;
  const options = interactionOptions(interaction);
  const chips = hints ?? HINTS[interaction.type];
  const clickOnly = engine.clickOnly;
  const micBlocked = engine.micError === "not-allowed" || engine.micError === "service-not-allowed";

  const submit = (value: string) => {
    const transcript = value.trim();
    if (!transcript || busy) return;
    engine.respond({ kind: "text", transcript });
    setText("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={option.id === engine.defaultOptionId ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => engine.respond({ kind: "click", optionId: option.id })}
          >
            {option.label}
          </Button>
        ))}
        {interaction.type === "edit" && engine.editLimitReached && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => engine.respond({ kind: "click", optionId: "editor" })}>
            Open editor
          </Button>
        )}
      </div>

      {clickOnly ? (
        <p className="text-xs text-muted">Tap a button to continue.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <form
              className="min-w-0 flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                submit(text);
              }}
            >
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="or type…"
                aria-label="Type your answer"
                disabled={busy}
                className="h-8 w-full rounded-lg border border-border bg-surface-2/40 px-3 text-xs text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:opacity-50"
              />
            </form>
            {engine.micSupported && (
              <button
                type="button"
                aria-label={engine.listening ? "Stop listening" : "Answer by voice"}
                title={micBlocked ? "Microphone blocked" : engine.listening ? "Stop listening" : "Answer by voice"}
                disabled={busy || micBlocked}
                onClick={() => (engine.listening ? engine.stopListening() : void engine.listen())}
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:pointer-events-none disabled:opacity-40",
                  engine.listening ? "border-primary text-primary-soft" : "border-border"
                )}
              >
                {micBlocked ? <MicOff size={14} /> : engine.listening ? <Square size={11} fill="currentColor" /> : <Mic size={14} />}
              </button>
            )}
          </div>

          {engine.listening ? (
            <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-agent-pulse" aria-hidden />
              {engine.interim ? <span className="text-fg/80">{engine.interim}</span> : "Listening…"}
            </p>
          ) : (
            chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted">Try saying</span>
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(chip)}
                    className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted transition-colors hover:border-primary/60 hover:text-fg disabled:opacity-50"
                  >
                    “{chip}”
                  </button>
                ))}
              </div>
            )
          )}
          {micBlocked && <p className="text-[11px] text-muted">Microphone is blocked. Type or tap instead.</p>}
        </>
      )}
    </div>
  );
}
