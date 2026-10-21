"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Play,
  Send,
} from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentTrace } from "@/components/agents/AgentTrace";

type Prep = {
  status: "queued" | "working" | "ready";
  lastTimeSummary: string;
  decisions: string[];
  openItems: { owner: string; due: string; title: string }[];
  relatedEmails: string[];
  relatedIssues: string[];
  relatedCommits: string[];
  talkingPoints: string[];
};
type Meeting = { id: string; title: string; time: string; startsAt: string; attendees: string[]; past: boolean; hasMom: boolean; prep: Prep | null };
type Run = { id: string; title: string; status: string; startedAt: string; steps: { id?: string; agent: string; action: string; tool: string; model: string; inputSummary: string; outputSummary: string; status: "running" | "done" | "failed"; handoffTo: string | null; startedAt?: string; finishedAt?: string | null }[] };

const CREW = [
  ["Scribe", "FileText", "Meeting notes and actions"],
  ["Courier", "Mail", "Email triage and drafts"],
  ["Tracker", "GitBranch", "GitHub and Jira updates"],
  ["Planner", "Check", "Tasks and reminders"],
  ["Historian", "Clock3", "Context from past work"],
  ["Reporter", "Send", "Weekly reporting"],
] as const;

export function TodayDashboard({
  userName,
  demoMode,
  meetings,
  tasks,
  pending: initialPending,
  runs: initialRuns,
}: {
  userName: string;
  demoMode: boolean;
  meetings: Meeting[];
  tasks: { id: string; title: string; source: string; createdBy: string }[];
  pending: { id: string; title: string; why: string; preview: string }[];
  runs: Run[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [runs, setRuns] = useState(initialRuns);
  const [openRun, setOpenRun] = useState<string | null>(initialRuns[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const activeRunId = runs.find((run) => run.status === "running")?.id ?? null;

  useEffect(() => {
    if (!activeRunId) return;
    const source = new EventSource(`/api/agents/stream?runId=${activeRunId}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { runs: Run[]; steps: Run["steps"] };
      if (data.runs[0]) setRuns((current) => current.map((run) => run.id === activeRunId ? { ...run, ...data.runs[0], steps: data.steps } : run));
      if (data.runs[0]?.status !== "running") {
        source.close();
        router.refresh();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [activeRunId, router]);

  const workingAgent = runs.find((run) => run.status === "running")?.steps.at(-1)?.agent;
  const statusLine = workingAgent
    ? `${workingAgent} is working now${pending.length ? `, with ${pending.length} thing${pending.length === 1 ? "" : "s"} waiting for your OK.` : "."}`
    : pending.length
      ? `All quiet. ${pending.length} thing${pending.length === 1 ? " needs" : "s need"} your OK.`
      : "All quiet. I’ll nudge you when something needs you.";

  async function simulate(workflow: "urgent_email" | "meeting_ended" | "start_day") {
    setBusy(true);
    setMenuOpen(false);
    const response = await fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow }) });
    const result = await response.json();
    setBusy(false);
    if (result.runId) {
      setOpenRun(result.runId);
      setRuns((current) => [{ id: result.runId, title: workflow === "urgent_email" ? "Urgent email: triage and draft a reply" : workflow === "meeting_ended" ? "Meeting ended: write minutes and plan actions" : "Start my day: prepare the agenda", status: "running", startedAt: new Date().toISOString(), steps: [] }, ...current]);
      router.refresh();
    }
  }

  async function approve(id: string) {
    await fetch("/api/approvals/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setPending((current) => current.filter((item) => item.id !== id));
    router.refresh();
  }

  const visibleRuns = useMemo(() => agentFilter ? runs.filter((run) => run.steps.some((step) => step.agent === agentFilter)) : runs, [agentFilter, runs]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <OwlMark size={42} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Good morning, {userName}</h1>
            <p className="mt-1 text-sm text-muted">{statusLine}</p>
          </div>
        </div>
        {demoMode && (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setMenuOpen((value) => !value)} disabled={busy}>
              <Play className="h-3.5 w-3.5" /> Simulate <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-border bg-surface p-1">
                <button className="menu-row" onClick={() => simulate("urgent_email")}>New urgent email</button>
                <button className="menu-row" onClick={() => simulate("meeting_ended")}>Meeting just ended</button>
                <button className="menu-row" onClick={() => simulate("start_day")}>Start my day</button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
        <main className="min-w-0 space-y-8">
          <section>
            <SectionTitle title="Today’s insights" detail={<button className="text-xs text-primary-soft hover:underline" onClick={() => router.refresh()}>Refresh insights</button>} />
            <ul className="space-y-2 border-y border-border py-4 text-sm text-fg/85">
              {meetings.slice(0, 1).map((meeting) => <li key={meeting.id}>• {meeting.title} at {meeting.time.split(" – ")[0]}{meeting.prep?.lastTimeSummary ? `: ${meeting.prep.lastTimeSummary}` : " is on your calendar."}</li>)}
              {pending.slice(0, 1).map((item) => <li key={item.id}>• {item.title}: {item.why}</li>)}
              {tasks.slice(0, 2).map((task) => <li key={task.id}>• {task.title} came from {task.source} and is waiting in your task list.</li>)}
              {!meetings.length && !pending.length && !tasks.length && <li>• Getting your day ready…</li>}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {CREW.map(([name]) => {
                const status = workingAgent === name ? "working" : name === "Courier" && pending.length ? "waiting" : "idle";
                return <button key={name} onClick={() => setAgentFilter(agentFilter === name ? null : name)} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><span className={cn("h-2 w-2 rounded-full", status === "working" ? "animate-pulse bg-primary" : status === "waiting" ? "bg-nudge" : "bg-muted/50")} />{name}</button>;
              })}
              <button className="text-xs text-primary-soft hover:underline" onClick={() => setOpenRun(openRun ?? runs[0]?.id ?? null)}>View agent activity</button>
            </div>
          </section>
          <section>
            <SectionTitle title="Needs your OK" detail={pending.length ? `${pending.length} waiting` : "All clear"} />
            {pending.length === 0 ? <EmptyLine text="Nothing is waiting for your approval." /> : (
              <div className="divide-y divide-border border-y border-border">
                {pending.map((item) => (
                  <div key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted">{item.why}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(item.id)}><Send className="h-3.5 w-3.5" /> Approve</Button>
                        <Button size="sm" variant="ghost">Edit</Button>
                        <Button size="sm" variant="ghost">Skip</Button>
                      </div>
                    </div>
                    <p className="mt-3 border-l-2 border-border pl-3 text-sm text-fg/80">{item.preview}</p>
                    <AgentTrace collapsed run={runs.find((run) => run.status === "waiting_for_user") ? {
                      ...runs.find((run) => run.status === "waiting_for_user")!,
                      steps: runs.find((run) => run.status === "waiting_for_user")!.steps,
                    } : null} />
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>

        <aside className="space-y-6">
          <section>
            <SectionTitle title="To-do tasks" detail={agentFilter ? `Filtered to ${agentFilter}` : `${tasks.length} open`} />
            <div className="divide-y divide-border border-y border-border">
              {tasks.length ? tasks.map((task) => <div key={task.id} className="flex items-start gap-2 py-3"><span className="mt-0.5 h-4 w-4 rounded border border-border" /><span className="min-w-0 flex-1 text-sm">{task.title}<span className="mt-1 block text-xs text-muted">{task.source} · {task.createdBy}</span></span></div>) : <EmptyLine text="All caught up." />}
            </div>
            <button className="mt-3 text-xs text-primary-soft hover:underline" onClick={() => router.push("/tasks")}>View all tasks</button>
          </section>
          <section>
            <SectionTitle title="Agent activity" detail={agentFilter ? `Filtered to ${agentFilter}` : undefined} />
            <div className="divide-y divide-border border-y border-border">
              {visibleRuns.length ? visibleRuns.map((run) => <RunRow key={run.id} run={run} open={openRun === run.id} onToggle={() => setOpenRun(openRun === run.id ? null : run.id)} />) : <EmptyLine text="Getting your day ready…" />}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: ReactNode }) {
  return <div className="mb-3 flex items-baseline justify-between"><h2 className="text-base font-semibold">{title}</h2>{detail && <span className="text-xs text-muted">{detail}</span>}</div>;
}
function EmptyLine({ text }: { text: string }) { return <p className="border-y border-border py-5 text-sm text-muted">{text}</p>; }
function RunRow({ run, open, onToggle }: { run: Run; open: boolean; onToggle: () => void }) {
  const chain = [...new Set(run.steps.map((step) => step.agent))].join(" → ") || "Nudge";
  return <div className="py-3">
    <button className="flex w-full items-start gap-2 text-left" onClick={onToggle}><span className="mt-1 text-muted">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{run.title}</span><span className="mt-1 block truncate text-xs text-muted">{chain}</span></span><span className={cn("text-xs", run.status === "waiting_for_user" ? "text-nudge" : run.status === "running" ? "text-primary-soft" : "text-muted")}>{run.status === "waiting_for_user" ? "Waiting for you" : run.status}</span></button>
    {open && <div className="ml-6 mt-3 space-y-3 border-l border-border pl-3">{run.steps.map((step, index) => <div key={`${step.agent}-${index}`} className="animate-fade-up text-xs"><div className="flex flex-wrap gap-2 text-fg/80"><strong>{step.agent}</strong><span>{step.action}</span><span className="text-muted">· {step.model.split(" · ")[0]}</span></div><p className="mt-1 text-muted">{step.inputSummary} → {step.outputSummary}</p>{step.handoffTo && <p className="mt-1 text-primary-soft">Hands off to {step.handoffTo}</p>}</div>)}</div>}
  </div>;
}
