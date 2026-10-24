"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Run = { text: string; spoken: boolean; highlight: boolean };

/** Splits a line into runs by spoken/unspoken and highlighted (case-insensitive) ranges. */
export function captionRuns(text: string, highlights: string[], spokenChars: number): Run[] {
  const marked = new Uint8Array(text.length);
  const lower = text.toLowerCase();
  for (const h of highlights) {
    const needle = h.trim().toLowerCase();
    if (!needle) continue;
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
      marked.fill(1, at, at + needle.length);
    }
  }
  const runs: Run[] = [];
  for (let i = 0; i < text.length; i++) {
    const spoken = i < spokenChars;
    const highlight = marked[i] === 1;
    const last = runs[runs.length - 1];
    if (last && last.spoken === spoken && last.highlight === highlight) last.text += text[i];
    else runs.push({ text: text[i], spoken, highlight });
  }
  return runs;
}

/**
 * The line Nudge is saying. Spoken words brighten as they are reached; names, ticket keys and
 * counts in `highlights` are set in medium weight.
 */
export function Caption({
  text,
  highlights = [],
  spokenChars,
  className,
}: {
  text: string;
  highlights?: string[];
  /** Characters spoken so far; omit to show the whole line as spoken. */
  spokenChars?: number;
  className?: string;
}) {
  const runs = useMemo(
    () => captionRuns(text, highlights, spokenChars ?? text.length),
    [text, highlights, spokenChars]
  );
  if (!text) return null;
  return (
    <p className={cn("text-pretty text-lg leading-relaxed", className)}>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <span aria-hidden>
        {runs.map((run, i) => (
          <span
            key={i}
            className={cn(
              "transition-colors duration-200",
              run.spoken ? "text-fg/80" : "text-muted/50",
              run.highlight && "font-medium",
              run.highlight && run.spoken && "text-fg"
            )}
          >
            {run.text}
          </span>
        ))}
      </span>
    </p>
  );
}
