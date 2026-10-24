"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Clock3, Cpu, Wrench, X } from "lucide-react";
import { formatDuration, modelLabel, type RunView, type StepView } from "@/lib/agent-runs";
import { AGENT_JOBS, type AgentName } from "@/nudge/types";
import { AgentIcon } from "@/components/today/AgentIcon";
import { FoundRow } from "@/components/today/StepTimeline";
import { formatTime } from "@/lib/utils";

export type AgentDrawerProps = {
  run: RunView | null;
  agent: AgentName | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** "Show your work": every step one agent took in a run, with tools, model tier, findings and handoffs. */
export function AgentDrawer({ run, agent, open, onOpenChange }: AgentDrawerProps) {
  const steps = run && agent ? run.steps.filter((s) => s.agent === agent) : [];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-bg/60 animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[460px] flex-col border-l border-border bg-bg animate-fade-in focus:outline-none">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            {agent && <AgentIcon agent={agent} state={steps.some((s) => s.status === "running") ? "working" : "done"} size={32} />}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">{agent ?? "Agent"}</Dialog.Title>
              <Dialog.Description className="truncate text-xs text-muted">
                {agent ? AGENT_JOBS[agent] : ""}
                {run ? ` · ${steps.length} ${steps.length === 1 ? "step" : "steps"} in this run` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {steps.length === 0 ? (
              <p className="text-sm text-muted">{agent} wasn&apos;t needed for this run.</p>
            ) : (
              <ol className="space-y-6">
                {steps.map((step) => (
                  <li key={step.id}>
                    <StepDetail step={step} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepDetail({ step }: { step: StepView }) {
  const running = step.status === "running";
  return (
    <section className="border-l border-border pl-4">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-xs tabular-nums text-muted">#{step.seq}</span>
        <span className="font-medium text-fg">{step.phase}</span>
        <span className={running ? "ml-auto text-xs text-primary-soft" : step.status === "failed" ? "ml-auto text-xs text-danger" : "ml-auto text-xs text-muted"}>
          {running ? "Working" : step.status === "failed" ? "Skipped" : "Done"}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
        <dt className="flex items-center gap-1"><Wrench className="h-3 w-3" />Tool</dt>
        <dd className="min-w-0 truncate font-mono text-[11px] text-fg/80">{step.tool}</dd>
        <dt className="flex items-center gap-1"><Cpu className="h-3 w-3" />Model</dt>
        <dd className="min-w-0 truncate text-fg/80">{modelLabel(step)}</dd>
        {step.startedAt && (
          <>
            <dt className="flex items-center gap-1"><Clock3 className="h-3 w-3" />Timing</dt>
            <dd className="text-fg/80">
              {formatTime(step.startedAt)} · {running ? "running " : ""}{formatDuration(step.startedAt, step.finishedAt)}
            </dd>
          </>
        )}
      </dl>
      {step.narration && <p className="mt-3 text-sm leading-relaxed text-fg/90">{step.narration}</p>}
      {step.foundItems.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Found</p>
          <ul className="space-y-1">
            {step.foundItems.map((item, i) => (
              <li key={`${item.label}-${i}`}><FoundRow item={item} /></li>
            ))}
          </ul>
        </div>
      )}
      {step.handoffTo && step.handoffTo !== step.agent && (
        <div className="mt-3 rounded-lg border border-border px-3 py-2 text-xs">
          <p className="flex items-center gap-1.5 text-fg/80">
            <ArrowRight className="h-3 w-3 text-muted" />Handed off to <span className="font-medium text-fg">{step.handoffTo}</span>
          </p>
          {step.handoffSummary && <p className="mt-1 leading-relaxed text-muted">{step.handoffSummary}</p>}
        </div>
      )}
    </section>
  );
}
