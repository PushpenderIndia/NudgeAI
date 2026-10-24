"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Plus, RotateCcw } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { AgentTrace } from "@/components/agents/AgentTrace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDuration, isFinished, type RunView } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";
import { AgentIcon, FOUND_ICONS, SOURCE_LABEL } from "./AgentIcon";
import type { ApprovalView, InsightView, MeetingView, TaskView } from "./types";

/** State B: one compact "How I planned this" row, then the plan itself. */
export function PlanView({
  userName,
  dateLabel,
  plan,
  insights,
  approvals,
  tasks,
  meetings,
  onReplay,
  onWatch,
  onPlanAgain,
  planning,
}: {
  userName: string;
  dateLabel: string;
  plan: RunView | null;
  insights: InsightView[];
  approvals: ApprovalView[];
  tasks: TaskView[];
  meetings: MeetingView[];
  onReplay: () => void;
  onWatch: () => void;
  onPlanAgain: () => void;
  planning: boolean;
}) {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Here’s your day, {userName}.</h1>
      </header>

      <HowIPlanned plan={plan} onReplay={onReplay} onWatch={onWatch} onPlanAgain={onPlanAgain} planning={planning} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 space-y-10">
          {meetings.length > 0 && <DayStrip meetings={meetings} />}
          <Insights insights={insights} running={!isFinished(plan)} />
          <Approvals items={approvals} />
        </main>
        <aside className="min-w-0">
          <TaskRail tasks={tasks} />
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How I planned this                                                  */
/* ------------------------------------------------------------------ */
function HowIPlanned({ plan, onReplay, onWatch, onPlanAgain, planning }: { plan: RunView | null; onReplay: () => void; onWatch: () => void; onPlanAgain: () => void; planning: boolean }) {
  if (!plan) {
    return (
      <div className="flex items-center gap-3 border-y border-border py-3 text-sm text-muted">
        <OwlMark size={28} />
        <span className="flex-1">I haven’t planned today yet.</span>
        <Button size="sm" onClick={onPlanAgain} disabled={planning}>Plan my day</Button>
      </div>
    );
  }
  const running = !isFinished(plan);
  const chain = [...new Set(plan.steps.map((s) => s.agent).filter((a) => a !== "Nudge"))];
  const current = plan.steps.at(-1);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 animate-fade-in">
      <OwlMark size={28} blinking={running} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{running ? "Still planning" : "How I planned this"}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
          {running && current ? (
            <><AgentIcon agent={current.agent} state="working" size={16} /> {current.agent} is working…</>
          ) : (
            <>{chain.join(" → ") || "Nudge"}{plan.startedAt && <> · {formatDuration(plan.startedAt, plan.finishedAt)}</>}{plan.status === "failed" && " · stopped early"}</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {running ? (
          <Button size="sm" variant="ghost" onClick={onWatch}>Watch</Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onReplay}>Replay</Button>
            <Button size="sm" variant="ghost" onClick={onPlanAgain} disabled={planning}>
              <RotateCcw className="h-3.5 w-3.5" /> Plan my day again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Your day (meetings strip)                                           */
/* ------------------------------------------------------------------ */
function DayStrip({ meetings }: { meetings: MeetingView[] }) {
  return (
    <section>
      <SectionHeading title="Your day" detail={<Link href="/meetings" className="hover:text-fg">Meetings <ArrowUpRight className="inline h-3 w-3" /></Link>} />
      <ul className="divide-y divide-border/60">
        {meetings.map((m) => (
          <li key={m.id} className={cn("flex items-center gap-3 py-2 text-sm", m.past && "text-muted")}>
            <span className="w-16 shrink-0 tabular-nums text-xs text-muted">{m.time}</span>
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
            {m.status && <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">{m.status}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Today's insights                                                    */
/* ------------------------------------------------------------------ */
function Insights({ insights, running }: { insights: InsightView[]; running: boolean }) {
  return (
    <section>
      <SectionHeading title="Today’s insights" detail="From Historian and Nudge" />
      {insights.length === 0 ? (
        <p className="py-2 text-sm text-muted">{running ? "Still gathering these…" : "Nothing stood out from your recent work."}</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight) => {
            const Icon = insight.sourceType ? FOUND_ICONS[insight.sourceType as keyof typeof FOUND_ICONS] : null;
            const source = insight.sourceLabel && (
              <span className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted">
                {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} />}
                <span className="truncate">{insight.sourceLabel}</span>
              </span>
            );
            return (
              <li key={insight.id} className="flex gap-3 animate-fade-up">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary-soft" />
                <div className="min-w-0">
                  <p className="text-[15px] leading-relaxed text-fg/90">{insight.text}</p>
                  {source && (insight.href ? <Link href={insight.href} className="hover:text-fg hover:underline">{source}</Link> : source)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Needs your OK                                                       */
/* ------------------------------------------------------------------ */
const TYPE_LABEL: Record<ApprovalView["actionType"], string> = {
  send_email: "Email reply",
  post_jira_comment: "Jira comment",
  transition_ticket: "Ticket update",
  create_task: "New task",
  create_timesheet: "Timesheet",
  post_slack: "Slack post",
};

function Approvals({ items }: { items: ApprovalView[] }) {
  const router = useRouter();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const visible = items.filter((a) => !handled.has(a.id));

  function done(id: string, message: string) {
    setHandled((current) => new Set(current).add(id));
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
    router.refresh();
  }

  return (
    <section>
      <SectionHeading title="Needs your OK" detail={notice ? <span className="text-fg/80">{notice}</span> : visible.length ? `${visible.length} waiting` : undefined} />
      {visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">All caught up.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => <ApprovalCard key={item.id} item={item} onDone={done} />)}
        </div>
      )}
    </section>
  );
}

function ApprovalCard({ item, onDone }: { item: ApprovalView; onDone: (id: string, message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.preview);
  const [savedBody, setSavedBody] = useState(item.preview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(path: string, payload: Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.json();
  }

  async function approve() {
    setBusy(true);
    setError("");
    try {
      if (editing && body !== savedBody) await post("/api/approvals/edit", { id: item.id, body });
      const data = await post("/api/approvals/approve", { id: item.id });
      const result = data.results?.[0];
      if (!result?.ok) {
        setError(result?.message ?? data.message ?? "That didn’t go through.");
        return;
      }
      onDone(item.id, result.message);
    } catch {
      setError("I couldn’t reach the server. Try again?");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    await post("/api/approvals/edit", { id: item.id, body });
    setSavedBody(body);
    setEditing(false);
    setBusy(false);
  }

  async function skip() {
    setBusy(true);
    await post("/api/approvals/reject", { id: item.id });
    onDone(item.id, "Skipped. I won’t send it.");
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4 animate-fade-up">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{TYPE_LABEL[item.actionType]}</p>
      <h3 className="mt-1 font-medium">{item.title}</h3>
      <p className="mt-1 text-sm text-muted">{item.reason}</p>
      {editing ? (
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="mt-3 text-sm" aria-label="Edit draft" />
      ) : (
        <div className="mt-3 border-l-2 border-border pl-3 text-sm text-fg/80">
          {item.subject && <p className="mb-1 text-xs text-muted">{item.subject}</p>}
          <p className="line-clamp-4 whitespace-pre-line">{savedBody}</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={approve} disabled={busy}>
          <Check className="h-3.5 w-3.5" /> {item.actionType === "send_email" ? "Send" : "Approve"}
        </Button>
        {editing ? (
          <Button size="sm" variant="ghost" onClick={saveEdit} disabled={busy}>Save edit</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>
        )}
        <Button size="sm" variant="ghost" onClick={skip} disabled={busy}>Skip</Button>
      </div>
      {item.trace && <AgentTrace collapsed run={item.trace} className="mt-4" />}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* To-do tasks for today                                               */
/* ------------------------------------------------------------------ */
function TaskRail({ tasks }: { tasks: TaskView[] }) {
  const [added, setAdded] = useState<TaskView[]>([]);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const list = [...tasks, ...added.filter((a) => !tasks.some((t) => t.id === a.id))].filter((t) => !removed.has(t.id));

  async function complete(id: string) {
    setCompleting((current) => new Set(current).add(id));
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
    setTimeout(() => setRemoved((current) => new Set(current).add(id)), 450);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle("");
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: value, priority: "today" }) });
    const data = await res.json();
    if (data.task) setAdded((current) => [...current, { id: data.task.id, title: data.task.title, due: null, urgent: false, source: "manual", agent: "You" }]);
  }

  return (
    <section>
      <SectionHeading title="To-do tasks for today" detail={`${list.length} open`} />
      <ul className="divide-y divide-border/60">
        {list.map((task) => {
          const isDone = completing.has(task.id);
          return (
            <li key={task.id} className={cn("flex items-start gap-3 py-2.5 animate-fade-up transition-opacity duration-300", isDone && "opacity-50")}>
              <button
                type="button"
                onClick={() => complete(task.id)}
                disabled={isDone}
                aria-label={`Mark "${task.title}" done`}
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isDone ? "border-primary bg-primary text-white" : task.urgent ? "border-nudge/70 hover:bg-nudge/10" : "border-border hover:border-primary-soft"
                )}
              >
                {isDone && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", isDone && "line-through")}>{task.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted">
                  {task.urgent && <span className="text-nudge">Urgent</span>}
                  {task.due && <span>{task.due}</span>}
                  <span>{SOURCE_LABEL[task.source] ?? task.source}</span>
                  {task.agent !== "You" && <span>· {task.agent}</span>}
                </p>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-3 text-sm text-muted">Nothing on your list. Enjoy the quiet.</li>}
      </ul>
      <form onSubmit={add} className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <Plus className="h-3.5 w-3.5 text-muted" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="Add a task"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-fg placeholder:text-muted focus:outline-none"
        />
      </form>
      <Link href="/tasks" className="mt-3 inline-block text-xs text-muted hover:text-fg">All tasks <ArrowUpRight className="inline h-3 w-3" /></Link>
    </section>
  );
}
