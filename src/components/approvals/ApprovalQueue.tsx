"use client";

import { useEffect, useState } from "react";
import { Check, X, Pencil, Mail, SquareKanban, CheckCheck, Clock, ListPlus, FileClock } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";

type ActionType =
  | "send_email"
  | "post_jira_comment"
  | "transition_ticket"
  | "create_task"
  | "create_timesheet";

interface DraftContent {
  subject?: string;
  body?: string;
}

interface PendingItem {
  id: string;
  actionType: ActionType;
  summary: string;
  payload: Record<string, unknown>;
  draftId: string | null;
  draftContent: DraftContent | string | null;
  createdAt: string;
}

const TYPE_META: Record<
  ActionType,
  { label: string; variant: "email" | "jira" | "primary" | "default"; icon: typeof Mail }
> = {
  send_email: { label: "Email reply", variant: "email", icon: Mail },
  post_jira_comment: { label: "Jira comment", variant: "jira", icon: SquareKanban },
  transition_ticket: { label: "Ticket update", variant: "jira", icon: SquareKanban },
  create_task: { label: "New task", variant: "primary", icon: ListPlus },
  create_timesheet: { label: "Timesheet", variant: "default", icon: FileClock },
};

function getDraft(item: PendingItem): DraftContent | null {
  if (item.draftContent && typeof item.draftContent === "object") return item.draftContent;
  return null;
}

export function ApprovalQueue() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/approvals");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Couldn't load approvals.");
        if (active) setItems(data.pending ?? []);
      } catch {
        if (active) setError("Nudge couldn't load your approvals just now — try refreshing.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(""), 2500);
  }

  async function approve(ids: string[]) {
    setBusy(ids.length === 1 ? ids[0] : "all");
    try {
      const res = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length === 1 ? { id: ids[0] } : { ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't approve.");
      const okIds = new Set(
        (data.results ?? []).filter((r: { ok: boolean }) => r.ok).map((r: { id: string }) => r.id)
      );
      setItems((prev) => prev.filter((i) => !okIds.has(i.id)));
      const firstMsg = (data.results ?? []).find((r: { ok: boolean }) => r.ok)?.message;
      flash(ids.length > 1 ? `Approved ${data.executed} item${data.executed === 1 ? "" : "s"}.` : firstMsg ?? "Done.");
    } catch {
      flash("Something went wrong — nothing was sent.");
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/approvals/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setItems((prev) => prev.filter((i) => i.id !== id));
      flash(data.message ?? "Dismissed.");
    } catch {
      flash("Couldn't dismiss that — try again.");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(item: PendingItem) {
    const draft = getDraft(item);
    setEditingId(item.id);
    setEditSubject(draft?.subject ?? String(item.payload.subject ?? ""));
    setEditBody(draft?.body ?? String(item.payload.body ?? ""));
  }

  async function saveEdit(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/approvals/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subject: editSubject, body: editBody }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                draftContent: { subject: editSubject, body: editBody },
                payload: { ...i.payload, subject: editSubject, body: editBody },
              }
            : i
        )
      );
      setEditingId(null);
      flash("Saved your edits — Nudge will remember your style.");
    } catch {
      flash("Couldn't save that edit — try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 border-y border-border bg-surface/40 px-5 py-8 text-sm text-muted">
        <OwlMark size={24} />
        I&apos;m gathering what needs your OK…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-y border-danger/30 bg-danger/5 px-5 py-6 text-sm text-danger">{error}</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
        <OwlMark size={48} />
        <p className="mt-4 max-w-sm text-sm text-muted">
          All caught up. I&apos;ll bring anything that needs your OK here.
        </p>
        <p className="mt-3 text-xs text-muted">Nothing is sent without your approval.</p>
        {notice && <p className="mt-4 text-xs text-success">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Clock className="h-4 w-4" />
          <span>
            <span className="font-semibold text-fg">{items.length}</span> waiting
          </span>
          {notice && <span className="ml-2 text-success">· {notice}</span>}
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={busy !== null}
          onClick={() => {
            if (confirm(`Approve and execute all ${items.length} actions?`)) {
              approve(items.map((i) => i.id));
            }
          }}
        >
          <CheckCheck className="h-4 w-4" /> Approve all
        </Button>
      </div>

      {items.map((item) => {
        const meta = TYPE_META[item.actionType] ?? TYPE_META.create_task;
        const Icon = meta.icon;
        const draft = getDraft(item);
        const isEditing = editingId === item.id;
        return (
          <Card key={item.id} className="animate-fade-up overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant={meta.variant}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                </div>
                <p className="font-medium text-fg">{item.summary}</p>
              </div>
              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="success"
                    disabled={busy !== null}
                    onClick={() => approve([item.id])}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  {draft && (
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:text-danger"
                    disabled={busy !== null}
                    onClick={() => reject(item.id)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </div>

            {draft && !isEditing && (
              <div className="border-t border-border bg-surface-2/20 p-5 text-sm">
                {draft.subject && (
                  <p className="mb-2 font-semibold text-primary-soft">{draft.subject}</p>
                )}
                {draft.body && <p className="whitespace-pre-wrap text-fg/90">{draft.body}</p>}
              </div>
            )}

            {isEditing && (
              <div className="space-y-3 border-t border-border bg-surface-2/20 p-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Subject</label>
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Message</label>
                  <Textarea
                    className="min-h-[160px]"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => saveEdit(item.id)}>
                    <Check className="h-4 w-4" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
