"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Mail,
  Play,
  Send,
  Sparkles,
} from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
type Reply = { id: string; sender: string; subject: string; preview: string; receivedAt: string };
type Reminder = { id: string; kind: string; schedule: string; message: string };

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
  dateLabel,
  demoMode,
  meetings,
  tasks,
  replies,
  reminders,
  yesterdayInsights,
  pending: initialPending,
  runs: initialRuns,
}: {
  userName: string;
  dateLabel: string;
  demoMode: boolean;
  meetings: Meeting[];
  tasks: { id: string; title: string; source: string; createdBy: string }[];
  replies: Reply[];
  reminders: Reminder[];
  yesterdayInsights: { id: string; summary: string; action: string }[];
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
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <OwlMark size={44} />
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-primary-soft">{dateLabel}</p>
            <h1 className="text-3xl font-bold tracking-tight">Good morning, {userName}</h1>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <SectionTitle title="Yesterday’s insights" detail={<Sparkles className="h-4 w-4 text-primary-soft" />} />
              <div className="space-y-3">
                {yesterdayInsights.length ? yesterdayInsights.map((insight) => (
                  <div key={insight.id} className="flex gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div><p className="text-fg/90">{insight.summary}</p><p className="mt-1 text-xs text-muted">{insight.action}</p></div>
                  </div>
                )) : <p className="text-sm text-muted">No new activity was logged yesterday.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
              <SectionTitle title="Today at a glance" detail={<button className="text-xs text-primary-soft hover:underline" onClick={() => router.refresh()}>Refresh</button>} />
              <div className="grid grid-cols-3 gap-3">
                <Metric icon={<CalendarDays />} value={meetings.length} label="meetings" />
                <Metric icon={<Mail />} value={replies.length} label="to reply" />
                <Metric icon={<Bell />} value={reminders.length} label="nudges" />
              </div>
              <p className="mt-4 text-sm text-fg/80">{meetings[0] ? `Next up: ${meetings[0].title} at ${meetings[0].time.split(" – ")[0]}.` : "Your calendar is clear for now."}</p>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-surface p-5">
            <SectionTitle title="Today’s reminders" detail={`${reminders.length} active`} />
            <div className="grid gap-3 sm:grid-cols-3">
              {reminders.map((reminder) => <div key={reminder.id} className="rounded-xl border border-border/80 bg-bg/40 p-3.5"><div className="flex items-center justify-between"><Bell className="h-4 w-4 text-nudge" /><span className="text-[11px] font-medium uppercase tracking-wide text-muted">{reminder.schedule}</span></div><p className="mt-3 text-sm leading-5 text-fg/90">{reminder.message}</p></div>)}
              {!reminders.length && <p className="text-sm text-muted">No reminders are active.</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-surface p-5">
            <SectionTitle title="Mail to reply" detail={<button className="text-xs text-primary-soft hover:underline" onClick={() => router.push("/inbox")}>Open inbox <ArrowRight className="ml-1 inline h-3 w-3" /></button>} />
            <div className="divide-y divide-border">
              {replies.map((reply) => <div key={reply.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-soft">{reply.sender.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{reply.subject}</p><p className="mt-1 truncate text-xs text-muted">{reply.sender} · {reply.preview}</p></div><Clock3 className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" /></div>)}
              {!replies.length && <EmptyLine text="No replies are waiting." />}
            </div>
          </section>
          <section className="rounded-2xl border border-nudge/30 bg-nudge/5 p-5">
            <SectionTitle title="Needs your approval" detail={pending.length ? `${pending.length} waiting` : "All clear"} />
            {pending.length === 0 ? <EmptyLine text="Nothing is waiting for your approval." /> : (
              <div className="divide-y divide-border/70">
                {pending.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted">{item.why}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => approve(item.id)}><Send className="h-3.5 w-3.5" /> Approve</Button><Button size="sm" variant="ghost">Edit</Button></div></div>
                    <p className="mt-2 line-clamp-2 border-l-2 border-nudge/50 pl-3 text-sm text-fg/75">{item.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <SectionTitle title="Your crew" detail={<button className="text-xs text-primary-soft hover:underline" onClick={() => setOpenRun(openRun ?? runs[0]?.id ?? null)}>View activity</button>} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {CREW.map(([name]) => {
                const status = workingAgent === name ? "working" : name === "Courier" && pending.length ? "waiting" : "idle";
                return <button key={name} onClick={() => setAgentFilter(agentFilter === name ? null : name)} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><span className={cn("h-2 w-2 rounded-full", status === "working" ? "animate-pulse bg-primary" : status === "waiting" ? "bg-nudge" : "bg-muted/50")} />{name}</button>;
              })}
              <button className="text-xs text-primary-soft hover:underline" onClick={() => setOpenRun(openRun ?? runs[0]?.id ?? null)}>View agent activity</button>
            </div>
          </section>

        </main>

        <aside className="space-y-5">
          <section>
            <SectionTitle title="To-do tasks" detail={agentFilter ? `Filtered to ${agentFilter}` : `${tasks.length} open`} />
            <div className="rounded-2xl border border-border bg-surface px-4 divide-y divide-border">
              {tasks.length ? tasks.map((task) => <div key={task.id} className="flex items-start gap-2 py-3"><span className="mt-0.5 h-4 w-4 rounded border border-border" /><span className="min-w-0 flex-1 text-sm">{task.title}<span className="mt-1 block text-xs text-muted">{task.source} · {task.createdBy}</span></span></div>) : <EmptyLine text="All caught up." />}
            </div>
            <button className="mt-3 text-xs text-primary-soft hover:underline" onClick={() => router.push("/tasks")}>View all tasks</button>
          </section>
          <section>
            <SectionTitle title="Agent activity" detail={agentFilter ? `Filtered to ${agentFilter}` : undefined} />
            <div className="rounded-2xl border border-border bg-surface px-4 divide-y divide-border">
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
function Metric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return <div><div className="flex items-center gap-1.5 text-2xl font-semibold">{icon && <span className="h-4 w-4 text-primary-soft">{icon}</span>}{value}</div><p className="mt-1 text-[11px] text-muted">{label}</p></div>;
}
function EmptyLine({ text }: { text: string }) { return <p className="border-y border-border py-5 text-sm text-muted">{text}</p>; }
function RunRow({ run, open, onToggle }: { run: Run; open: boolean; onToggle: () => void }) {
  const chain = [...new Set(run.steps.map((step) => step.agent))].join(" → ") || "Nudge";
  return <div className="py-3">
    <button className="flex w-full items-start gap-2 text-left" onClick={onToggle}><span className="mt-1 text-muted">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{run.title}</span><span className="mt-1 block truncate text-xs text-muted">{chain}</span></span><span className={cn("text-xs", run.status === "waiting_for_user" ? "text-nudge" : run.status === "running" ? "text-primary-soft" : "text-muted")}>{run.status === "waiting_for_user" ? "Waiting for you" : run.status}</span></button>
    {open && <div className="ml-6 mt-3 space-y-3 border-l border-border pl-3">{run.steps.map((step, index) => <div key={`${step.agent}-${index}`} className="animate-fade-up text-xs"><div className="flex flex-wrap gap-2 text-fg/80"><strong>{step.agent}</strong><span>{step.action}</span><span className="text-muted">· {step.model.split(" · ")[0]}</span></div><p className="mt-1 text-muted">{step.inputSummary} → {step.outputSummary}</p>{step.handoffTo && <p className="mt-1 text-primary-soft">Hands off to {step.handoffTo}</p>}</div>)}</div>}
  </div>;
}
