import {
  Brain,
  CalendarDays,
  CircleDot,
  FileText,
  Flag,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  History,
  ListChecks,
  Mail,
  NotebookPen,
  PenLine,
  SquareCheck,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import type { FoundItemKind } from "@/db/schema";
import { OwlMark } from "@/components/NudgeLogo";
import { cn } from "@/lib/utils";

const AGENT_ICONS: Record<string, LucideIcon> = {
  Historian: History,
  Scribe: NotebookPen,
  Courier: Mail,
  Tracker: GitBranch,
  Planner: ListChecks,
  Reporter: FileText,
};

export type AgentState = "working" | "done" | "idle" | "failed";

/** Outline icon in a small ring: violet while working, grey otherwise. */
export function AgentIcon({ agent, state = "idle", size = 28 }: { agent: string; state?: AgentState; size?: number }) {
  const Icon = AGENT_ICONS[agent];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border bg-bg transition-colors duration-200",
        state === "working" ? "border-primary/60 text-primary-soft" : "border-border text-muted"
      )}
      style={{ width: size, height: size }}
    >
      {Icon ? (
        <Icon className={cn(state === "working" && "animate-agent-pulse")} style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.75} />
      ) : (
        <OwlMark size={size * 0.72} className={cn(state === "working" && "animate-agent-pulse")} />
      )}
    </span>
  );
}

export const FOUND_ICONS: Record<FoundItemKind, LucideIcon> = {
  meeting: CalendarDays,
  action_item: CircleDot,
  decision: Flag,
  email: Mail,
  jira: SquareKanban,
  commit: GitCommitHorizontal,
  pr: GitPullRequest,
  task: SquareCheck,
  draft: PenLine,
  memory: Brain,
};

export const SOURCE_LABEL: Record<string, string> = {
  meeting: "Meeting",
  action_item: "Meeting",
  decision: "Meeting",
  email: "Email",
  jira: "Jira",
  commit: "GitHub",
  pr: "GitHub",
  task: "Task",
  draft: "Draft",
  memory: "Memory",
  manual: "Added by you",
};
