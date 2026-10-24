"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Clock3, Cpu, Wrench, X } from "lucide-react";
import type { FoundItem } from "@/db/schema";
import { formatDuration, modelLabel, type StepView } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";
import { AgentIcon, FOUND_ICONS } from "./AgentIcon";
import type { Playback } from "./hooks";

const INLINE_ITEMS = 4;

/** Vertical timeline of narrated steps, revealed according to `playback`. */
export function StepTimeline({ steps, playback, className }: { steps: StepView[]; playback: Playback; className?: string }) {
  const visible = steps.slice(0, playback.index + 1);
  return (
    <ol className={cn("relative", className)} aria-live="polite">
      {visible.map((step, i) => {
        const current = i === playback.index;
        const waiting = current && step.status === "running";
        const revealed = !current;
        const next = steps[i + 1];
        return (
          <li key={step.id} className="animate-fade-up">
            <StepRow
              step={step}
              state={waiting || (current && !playback.complete) ? "working" : step.status === "failed" ? "failed" : "done"}
              narration={waiting ? "" : revealed ? step.narration : step.narration.slice(0, playback.chars)}
              itemsShown={revealed ? INLINE_ITEMS : playback.items}
              waiting={waiting}
              last={i === steps.length - 1 && !next}
            />
            {revealed && step.handoffTo && step.handoffTo !== step.agent && step.handoffSummary && (
              <Handoff from={step.agent} to={step.handoffTo} summary={step.handoffSummary} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepRow({
  step,
  state,
  narration,
  itemsShown,
  waiting,
  last,
}: {
  step: StepView;
  state: "working" | "done" | "failed";
  narration: string;
  itemsShown: number;
  waiting: boolean;
  last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const typing = state === "working" && !waiting && narration.length < step.narration.length;
  return (
    <div className="relative flex gap-4 pb-6">
      {!last && <span aria-hidden className="absolute left-[13.5px] top-8 bottom-0 w-px bg-border" />}
      <AgentIcon agent={step.agent} state={state === "working" ? "working" : state === "failed" ? "failed" : "done"} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold text-fg">{step.agent}</span>
          <span className="text-muted">{step.phase.toLowerCase()}</span>
          <span className="ml-auto flex items-center text-muted">
            {state === "done" && <Check aria-label="Done" className="h-3.5 w-3.5" />}
            {state === "failed" && <X aria-label="Skipped" className="h-3.5 w-3.5" />}
          </span>
        </div>
        {waiting ? (
          <p className="mt-1.5 text-sm text-muted animate-agent-pulse">Working…</p>
        ) : (
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg/90">
            {narration}
            {typing && <span aria-hidden className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-primary-soft animate-agent-pulse" />}
          </p>
        )}
        {step.foundItems.length > 0 && itemsShown > 0 && (
          <ul className="mt-2.5 space-y-1">
            {step.foundItems.slice(0, Math.min(itemsShown, INLINE_ITEMS)).map((item, i) => (
              <li key={`${item.label}-${i}`} className="animate-fade-up">
                <FoundRow item={item} />
              </li>
            ))}
          </ul>
        )}
        {!waiting && state !== "working" && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg"
            >
              {open ? "Hide details" : "Show details"}
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
            </button>
            {open && (
              <div className="mt-2 animate-fade-in space-y-2 border-l border-border pl-3 text-xs text-muted">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{step.tool}</span>
                  <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{modelLabel(step)}</span>
                  {step.startedAt && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatDuration(step.startedAt, step.finishedAt)}</span>}
                </div>
                {step.foundItems.length > 0 ? (
                  <ul className="space-y-1">
                    {step.foundItems.map((item, i) => <li key={`${item.label}-${i}`}><FoundRow item={item} /></li>)}
                  </ul>
                ) : (
                  <p>Nothing specific to list for this step.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FoundRow({ item }: { item: FoundItem }) {
  const Icon = FOUND_ICONS[item.kind] ?? Check;
  const body = (
    <span className={cn("flex min-w-0 items-center gap-2 text-[13px]", item.urgent ? "text-nudge" : "text-fg/75")}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0 truncate">{item.label}</span>
      {item.detail && <span className="min-w-0 max-w-[45%] shrink-[3] truncate text-xs text-muted">{item.detail}</span>}
    </span>
  );
  return item.href ? <Link href={item.href} className="block rounded hover:bg-surface-2/50">{body}</Link> : body;
}

function Handoff({ from, to, summary }: { from: string; to: string; summary: string }) {
  return (
    <div className="-mt-3 mb-3 flex items-center gap-3 pl-[13.5px] animate-fade-in">
      <span aria-hidden className="h-px w-5 bg-border" />
      <p className="text-xs text-muted">
        <span className="text-fg/70">{from} → {to}:</span> {summary}
      </p>
    </div>
  );
}
