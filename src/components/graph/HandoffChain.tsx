import { formatDuration, type RunView } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";

/** Specialists in the order they first worked (Nudge, the orchestrator, is implied). */
export function handoffAgents(run: Pick<RunView, "steps">) {
  return [...new Set(run.steps.map((s) => s.agent))].filter((a) => a !== "Nudge");
}

/** Compact "Historian → Tracker → Planner → Reporter → Courier · 14.2s" for the How I planned this row. */
export function HandoffChain({ run, className }: { run: Pick<RunView, "steps" | "startedAt" | "finishedAt">; className?: string }) {
  const agents = handoffAgents(run);
  if (agents.length === 0) return null;
  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted", className)}>
      {agents.map((agent, i) => (
        <span key={agent} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-border">→</span>}
          <span className="text-fg/80">{agent}</span>
        </span>
      ))}
      {run.startedAt && <span className="tabular-nums">· {formatDuration(run.startedAt, run.finishedAt)}</span>}
    </p>
  );
}
