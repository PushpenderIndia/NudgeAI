import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PagePlaceholder";
import { AgentIcon } from "@/components/today/AgentIcon";
import { RunStatusBadge, TRIGGER_LABEL } from "@/components/graph/RunBadges";
import { formatDuration } from "@/lib/agent-runs";
import { listRuns } from "@/lib/runs";
import { getRequestContext } from "@/nudge/session";

export const dynamic = "force-dynamic";

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";

export default async function RunsPage() {
  const { sessionKey } = await getRequestContext();
  const runs = await listRuns(sessionKey);
  return (
    <div>
      <PageHeader title="Runs" subtitle="Every time my team worked for you: who did what, in order, and what they handed off." />
      {runs.length === 0 ? (
        <p className="border-y border-border py-12 text-center text-sm text-muted">No runs yet. Start your day on Today and they&apos;ll show up here.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {runs.map((run) => (
            <li key={run.id}>
              <Link href={`/runs/${run.id}`} className="group flex items-center gap-4 px-1 py-3.5 transition-colors hover:bg-surface/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{run.title}</span>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {TRIGGER_LABEL[run.type] ?? run.type} · {when(run.startedAt)}
                    {run.startedAt && ` · ${formatDuration(run.startedAt, run.finishedAt)}`} · {run.stepCount} {run.stepCount === 1 ? "step" : "steps"}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center -space-x-1.5 sm:flex" aria-label={`Agents: ${run.agents.join(", ")}`}>
                  {run.agents.map((agent) => (
                    <span key={agent} title={agent}>
                      <AgentIcon agent={agent} size={24} />
                    </span>
                  ))}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-fg" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
