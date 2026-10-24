import { Badge } from "@/components/ui/badge";
import type { RunView } from "@/lib/agent-runs";

export const TRIGGER_LABEL: Record<string, string> = {
  plan_day: "Plan my day",
  meeting_prep: "Meeting prep",
  weekly_update: "Weekly update",
  urgent_email: "Urgent email",
  meeting_ended: "Meeting ended",
};

const STATUS: Record<RunView["status"], { label: string; variant: "primary" | "default" | "danger" | "urgent" }> = {
  running: { label: "Running", variant: "primary" },
  waiting_for_user: { label: "Waiting for you", variant: "default" },
  done: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "danger" },
};

export function RunStatusBadge({ status }: { status: RunView["status"] }) {
  const s = STATUS[status] ?? STATUS.done;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const SOURCE: Record<string, string> = {
  model: "Script: model",
  template: "Script: template",
  fallback: "Script: fallback",
};

export function ScriptSourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  return <Badge title="Where the spoken scene script came from">{SOURCE[source] ?? source}</Badge>;
}
