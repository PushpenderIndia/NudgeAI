"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock3, Cpu, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentTraceStep = {
  id?: string;
  agent: string;
  action: string;
  tool: string;
  model: string;
  inputSummary: string;
  outputSummary: string;
  handoffTo?: string | null;
  status: "running" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string | null;
};

export type AgentTraceRun = {
  id: string;
  title: string;
  status: "running" | "waiting_for_user" | "done" | "failed" | string;
  startedAt?: string;
  finishedAt?: string | null;
  steps: AgentTraceStep[];
};

function duration(step: AgentTraceStep) {
  if (!step.startedAt) return null;
  const end = step.finishedAt ? new Date(step.finishedAt).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(step.startedAt).getTime());
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusLabel(status: AgentTraceRun["status"]) {
  if (status === "waiting_for_user") return "Waiting for you";
  if (status === "running") return "Working";
  if (status === "failed") return "Needs attention";
  return "Done";
}

export function AgentTrace({
  run,
  collapsed = false,
  className,
}: {
  run: AgentTraceRun | null;
  collapsed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(!collapsed);
  const chain = useMemo(
    () => [...new Set((run?.steps ?? []).flatMap((step) => [step.agent, step.handoffTo].filter(Boolean) as string[]))],
    [run]
  );

  if (!run) {
    return <p className={cn("text-xs text-muted", className)}>No agent run linked yet.</p>;
  }

  return (
    <div className={cn("border-t border-border pt-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-xs text-muted transition-colors hover:text-fg"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium text-fg">How I got this</span>
        <span className="truncate">{chain.length ? chain.join(" → ") : "Nudge"}</span>
        <span className="ml-auto shrink-0">{statusLabel(run.status)}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 pl-5">
          {run.steps.length === 0 ? (
            <p className="text-xs text-muted">Getting the next step ready…</p>
          ) : (
            run.steps.map((step, index) => (
              <div key={step.id ?? `${step.agent}-${index}`} className="animate-fade-up border-l border-border pl-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-fg">{step.agent}</span>
                  <span>{step.action}</span>
                  <span className={cn("ml-auto", step.status === "running" ? "text-primary-soft" : "text-muted")}>
                    {step.status === "running" ? "Working" : step.status === "failed" ? "Failed" : "Done"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted">
                  <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{step.tool}</span>
                  <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{step.model}</span>
                  {duration(step) && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{duration(step)}</span>}
                </div>
                <p className="mt-1 text-fg/70">In: {step.inputSummary}</p>
                <p className="text-fg/80">Out: {step.outputSummary}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
