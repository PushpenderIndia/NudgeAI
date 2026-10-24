"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionStatus, ActionType } from "@/db/schema";

export interface ApprovalRow {
  id: string;
  actionType: ActionType;
  summary: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  reason: string | null;
  runId: string | null;
  approvedVia: "voice" | "click" | null;
  executeAfter: string | null;
  executedLabel: string | null;
  createdLabel: string | null;
}

const TYPE_LABEL: Record<ActionType, string> = {
  transition_ticket: "Jira change",
  post_slack: "Slack post",
  send_email: "Email",
  create_timesheet: "Timesheet",
  post_jira_comment: "Ticket comment",
  create_task: "Task",
};

const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
const firstLines = (text: string | null, n = 2) => text?.split("\n").filter(Boolean).slice(0, n).join("\n") ?? null;

function preview(a: ApprovalRow): { head: string | null; body: string | null } {
  const p = a.payload;
  switch (a.actionType) {
    case "transition_ticket": {
      const key = str(p.key ?? p.issueKey);
      const from = str(p.from);
      const to = str(p.to ?? p.toStatus);
      return { head: [key, from && to ? `${from} → ${to}` : to && `→ ${to}`].filter(Boolean).join("  "), body: p.pr ? `PR #${p.pr}` : null };
    }
    case "post_slack":
      return { head: str(p.channel), body: firstLines(str(p.text)) };
    case "send_email":
      return { head: str(p.to) && `To ${p.to}`, body: str(p.subject) };
    case "post_jira_comment":
      return { head: str(p.issueKey ?? p.key), body: firstLines(str(p.comment ?? p.body), 1) };
    case "create_task":
      return { head: null, body: str(p.title) };
    default:
      return { head: null, body: null };
  }
}

export function ApprovalsList({ items }: { items: ApprovalRow[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const counting = items.some((a) => a.executeAfter && Date.parse(a.executeAfter) > now);
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (items.every((a) => !a.executeAfter || Date.parse(a.executeAfter) <= next)) setTimeout(() => router.refresh(), 600);
    }, 250);
    return () => clearInterval(t);
  }, [counting, items, router]);

  function call(path: string, body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; results?: { ok: boolean; message: string }[] } | null;
      const result = data?.results?.[0] ?? data;
      if (!res.ok || result?.ok === false) setError(result?.message ?? "That didn't work. Try again.");
      setNow(Date.now());
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">No outward actions yet. When I draft one, it waits here for your OK.</p>;
  }

  const groups = [
    { title: "Pending", rows: items.filter((a) => a.status === "pending") },
    { title: "Approved", rows: items.filter((a) => a.status === "approved" || a.status === "executed") },
    { title: "Declined", rows: items.filter((a) => a.status === "rejected") },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-danger">{error}</p>}
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {g.title} <span className="font-normal">· {g.rows.length}</span>
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {g.rows.map((a) => (
              <Row key={a.id} a={a} now={now} busy={busy} onCall={call} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ a, now, busy, onCall }: { a: ApprovalRow; now: number; busy: boolean; onCall: (path: string, body: Record<string, unknown>) => void }) {
  const { head, body } = preview(a);
  const left = a.executeAfter ? Math.ceil((Date.parse(a.executeAfter) - now) / 1000) : 0;
  const via = a.approvedVia === "voice" ? "Approved by voice" : a.approvedVia === "click" ? "Approved by click" : null;
  const meta = [
    a.status === "executed" ? [via, a.executedLabel && `ran ${a.executedLabel}`].filter(Boolean).join(", ") : null,
    a.status === "approved" && left > 0 ? via : null,
    a.status === "approved" && left <= 0 ? "Running…" : null,
    a.status !== "executed" && a.status !== "approved" ? a.createdLabel : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 px-1 py-3.5 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-soft">{TYPE_LABEL[a.actionType] ?? a.actionType}</span>
          <span className="text-sm font-medium text-fg">{a.summary}</span>
        </div>
        {(head || body) && (
          <div className="mt-1 text-xs text-muted">
            {head && <p className="font-mono text-fg/80">{head}</p>}
            {body && <p className="mt-0.5 line-clamp-2 whitespace-pre-line">{body}</p>}
          </div>
        )}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {meta.map((m) => (
            <span key={m as string}>{m}</span>
          ))}
          {a.runId && (
            <Link href={`/runs/${a.runId}`} className="inline-flex items-center gap-1 text-primary-soft hover:underline">
              Trace <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {a.status === "pending" && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onCall("/api/approvals/approve", { id: a.id, via: "click" })}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onCall("/api/approvals/reject", { id: a.id })}>
              <X className="h-3.5 w-3.5" /> Dismiss
            </Button>
          </>
        )}
        {a.status === "approved" && left > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onCall("/api/approvals/undo", { id: a.id })}>
            <Undo2 className="h-3.5 w-3.5" /> Undo ({left}s)
          </Button>
        )}
      </div>
    </li>
  );
}
