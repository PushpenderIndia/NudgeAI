import type { AgentName } from "@/nudge/types";
import { cn } from "@/lib/utils";

/** "Planner is ranking your tasks…" with a small violet working dot. */
export function StatusLine({
  agent,
  text,
  className,
}: {
  agent?: AgentName | null;
  text?: string | null;
  className?: string;
}) {
  if (!agent && !text) return null;
  return (
    <p className={cn("flex items-center gap-2 text-xs text-muted", className)} aria-live="polite">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-agent-pulse" aria-hidden />
      <span>{text || `${agent} is working…`}</span>
    </p>
  );
}
