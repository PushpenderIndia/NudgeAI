"use client";

import { useState, useMemo } from "react";
import {
  Mail,
  PenLine,
  Send,
  Pencil,
  RotateCw,
  X,
  Check,
  AlertCircle,
  Inbox as InboxIcon,
} from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Input } from "@/components/ui/input";
import { cn, formatTime, initials } from "@/lib/utils";

type Triage = "urgent" | "needs_reply" | "fyi" | null;

export interface EmailDTO {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  triage: Triage;
  triageReason: string | null;
  isSent: boolean;
}

interface DraftState {
  subject: string;
  body: string;
  actionId: string;
  tone: string;
}

const TONES = ["formal", "friendly", "concise"] as const;

const TRIAGE_META: Record<string, { label: string; variant: "urgent" | "primary" | "default" }> = {
  urgent: { label: "Urgent", variant: "urgent" },
  needs_reply: { label: "Needs reply", variant: "primary" },
  fyi: { label: "FYI", variant: "default" },
};

const GROUPS: { key: "urgent" | "needs_reply" | "fyi"; label: string }[] = [
  { key: "urgent", label: "Urgent" },
  { key: "needs_reply", label: "Needs reply" },
  { key: "fyi", label: "FYI" },
];

export function InboxView({ initialEmails }: { initialEmails: EmailDTO[] }) {
  const [emails, setEmails] = useState<EmailDTO[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEmails.find((e) => e.triage === "urgent")?.id ?? initialEmails[0]?.id ?? null
  );
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [tones, setTones] = useState<Record<string, string>>({});
  const [triaging, setTriaging] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const selected = emails.find((e) => e.id === selectedId) ?? null;
  const untriaged = emails.filter((e) => !e.triage && !e.isSent).length;

  const grouped = useMemo(() => {
    const g: Record<string, EmailDTO[]> = { urgent: [], needs_reply: [], fyi: [], untriaged: [] };
    for (const e of emails) {
      if (e.isSent) continue;
      g[e.triage ?? "untriaged"].push(e);
    }
    return g;
  }, [emails]);

  async function refreshEmails() {
    const res = await fetch("/api/emails");
    const data = await res.json();
    setEmails(data.emails.map((e: EmailDTO & { receivedAt: string }) => ({ ...e })));
  }

  async function triageInbox() {
    setTriaging(true);
    setBanner(null);
    try {
      const res = await fetch("/api/skills/email-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Triage failed.");
      await refreshEmails();
      setBanner({
        kind: "ok",
        text: `Sorted ${data.triaged} email${data.triaged === 1 ? "" : "s"}${data.tasksCreated ? `, created ${data.tasksCreated} urgent task${data.tasksCreated === 1 ? "" : "s"}` : ""}.`,
      });
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Couldn't triage." });
    } finally {
      setTriaging(false);
    }
  }

  async function draftReply(email: EmailDTO) {
    setDrafting(true);
    setEditing(false);
    setBanner(null);
    try {
      const tone = tones[email.id] ?? "friendly";
      const res = await fetch("/api/skills/email-reply-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't draft a reply.");
      setDrafts((d) => ({
        ...d,
        [email.id]: { subject: data.draft.subject, body: data.draft.body, actionId: data.actionId, tone: data.tone },
      }));
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Couldn't draft." });
    } finally {
      setDrafting(false);
    }
  }

  async function approve(email: EmailDTO) {
    const draft = drafts[email.id];
    if (!draft) return;
    const res = await fetch("/api/approvals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.actionId }),
    });
    const data = await res.json();
    if (res.ok && data.executed > 0) {
      setBanner({ kind: "ok", text: `Sent to ${email.fromName}. Logged in your activity feed.` });
      setDrafts((d) => {
        const next = { ...d };
        delete next[email.id];
        return next;
      });
      await refreshEmails();
    } else {
      setBanner({ kind: "err", text: data.results?.[0]?.message ?? "Couldn't send." });
    }
  }

  async function reject(email: EmailDTO) {
    const draft = drafts[email.id];
    if (!draft) return;
    await fetch("/api/approvals/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.actionId }),
    });
    setDrafts((d) => {
      const next = { ...d };
      delete next[email.id];
      return next;
    });
    setBanner({ kind: "ok", text: "Draft dismissed — nothing was sent." });
  }

  async function saveEdit(email: EmailDTO) {
    const draft = drafts[email.id];
    if (!draft) return;
    await fetch("/api/approvals/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draft.actionId, subject: draft.subject, body: draft.body }),
    });
    setEditing(false);
    setBanner({ kind: "ok", text: "Saved your edits — Nudge will remember your style." });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {untriaged > 0 ? `${untriaged} email${untriaged === 1 ? "" : "s"} waiting to be sorted` : "Inbox sorted"}
        </p>
        <Button size="sm" onClick={triageInbox} disabled={triaging || untriaged === 0}>
          {triaging ? <><OwlMark size={16} /> Sorting…</> : <><Check className="h-4 w-4" /> Sort inbox</>}
        </Button>
      </div>

      {banner && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm animate-fade-up",
            banner.kind === "ok" ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"
          )}
        >
          {banner.kind === "ok" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {banner.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <div className="space-y-4">
          {GROUPS.map((group) => {
            const items = grouped[group.key];
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <Badge variant={TRIAGE_META[group.key].variant}>{group.label}</Badge>
                  <span className="text-xs text-muted">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((e) => (
                    <EmailRow key={e.id} email={e} active={e.id === selectedId} onClick={() => { setSelectedId(e.id); setEditing(false); }} />
                  ))}
                </div>
              </div>
            );
          })}
          {grouped.untriaged.length > 0 && (
            <div>
              <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Not yet sorted</div>
              <div className="space-y-1.5">
                {grouped.untriaged.map((e) => (
                  <EmailRow key={e.id} email={e} active={e.id === selectedId} onClick={() => { setSelectedId(e.id); setEditing(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <EmptyDetail />
          ) : (
            <div className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{selected.subject}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {selected.fromName} · {selected.fromEmail} · {formatTime(selected.receivedAt)}
                    </p>
                  </div>
                  {selected.triage && <Badge variant={TRIAGE_META[selected.triage].variant}>{TRIAGE_META[selected.triage].label}</Badge>}
                </div>
                {selected.triageReason && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted">
                    <OwlMark size={14} /> Nudge: {selected.triageReason}
                  </p>
                )}
              </div>

              <div className="whitespace-pre-wrap border-b border-border p-5 text-sm text-fg/90">{selected.body}</div>

              {/* Draft area */}
              <div className="p-5">
                {selected.isSent ? (
                  <p className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" /> You replied to this.</p>
                ) : selected.triage === "fyi" ? (
                  <p className="text-sm text-muted">This looks like an FYI — no reply needed. You can still draft one if you like.</p>
                ) : null}

                {!drafts[selected.id] ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => draftReply(selected)} disabled={drafting}>
                      {drafting ? <><OwlMark size={16} /> Drafting…</> : <><PenLine className="h-4 w-4" /> Draft a reply</>}
                    </Button>
                    <TonePicker value={tones[selected.id] ?? "friendly"} onChange={(t) => setTones((s) => ({ ...s, [selected.id]: t }))} />
                  </div>
                ) : (
                  <div className="animate-fade-up space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <OwlMark size={14} /> Drafted reply · tone: {drafts[selected.id].tone}
                    </div>
                    {editing ? (
                      <div className="space-y-2">
                        <Input
                          value={drafts[selected.id].subject}
                          onChange={(ev) => setDrafts((d) => ({ ...d, [selected.id]: { ...d[selected.id], subject: ev.target.value } }))}
                        />
                        <Textarea
                          rows={8}
                          value={drafts[selected.id].body}
                          onChange={(ev) => setDrafts((d) => ({ ...d, [selected.id]: { ...d[selected.id], body: ev.target.value } }))}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => saveEdit(selected)}><Check className="h-4 w-4" /> Save edits</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-sm">
                        <p className="mb-1 font-medium text-fg">{drafts[selected.id].subject}</p>
                        <p className="whitespace-pre-wrap text-fg/90">{drafts[selected.id].body}</p>
                      </div>
                    )}

                    {!editing && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="success" onClick={() => approve(selected)}><Send className="h-4 w-4" /> Approve &amp; Send</Button>
                        <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="ghost" onClick={() => draftReply(selected)}><RotateCw className="h-4 w-4" /> Regenerate</Button>
                        <Button variant="ghost" onClick={() => reject(selected)}><X className="h-4 w-4" /> Reject</Button>
                      </div>
                    )}
                    <p className="text-xs text-muted">Nothing is sent until you press Approve.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailRow({ email, active, onClick }: { email: EmailDTO; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary/50 bg-surface-2" : "border-border bg-surface hover:bg-surface-2/60"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-primary-soft">
        {initials(email.fromName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{email.fromName}</p>
        <p className="truncate text-xs text-muted">{email.subject}</p>
      </div>
      {email.triage === "urgent" && <span className="h-2 w-2 shrink-0 rounded-full bg-nudge" />}
    </button>
  );
}

function TonePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
      {TONES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors",
            value === t ? "bg-primary text-white" : "text-muted hover:text-fg"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
      <InboxIcon className="h-8 w-8 text-muted" />
      <p className="mt-3 max-w-xs text-sm text-muted">Select an email to see Nudge&apos;s triage and draft a reply.</p>
    </div>
  );
}

export { Mail };
