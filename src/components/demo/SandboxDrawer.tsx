"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Hash, Inbox, KanbanSquare } from "lucide-react";
import { ResetDemoButton } from "@/components/demo/ResetDemoButton";
import { SANDBOX_REFRESH_EVENT, useDemoMode } from "@/lib/demo-client";
import { cn } from "@/lib/utils";
import type { OutboxEmail, SlackMessage, Ticket, TicketStatus } from "@/nudge/types";

type Sandbox = { tickets: Ticket[]; slack: SlackMessage[]; outbox: OutboxEmail[] };

const COLUMNS: TicketStatus[] = ["To Do", "In Progress", "In Review", "Done"];
const HIGHLIGHT_MS = 3000;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Ids that are new or changed between two snapshots (tickets compare by status). */
function changedIds(prev: Sandbox, next: Sandbox): string[] {
  const before = new Map(prev.tickets.map((t) => [t.key, t.status]));
  const seen = new Set([...prev.slack.map((m) => m.id), ...prev.outbox.map((e) => e.id)]);
  return [
    ...next.tickets.filter((t) => before.get(t.key) !== t.status).map((t) => t.key),
    ...[...next.slack, ...next.outbox].filter((x) => !seen.has(x.id)).map((x) => x.id),
  ];
}

/**
 * Demo-only Sandbox: the fake Jira board, #team-standup channel and Outbox
 * where approved outward actions land. Polls while open.
 */
export function SandboxDrawer({ defaultOpen = false, className }: { defaultOpen?: boolean; className?: string }) {
  const demo = useDemoMode();
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState<Sandbox | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const prev = useRef<Sandbox | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/demo/sandbox", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as Sandbox;
    const changed = prev.current ? changedIds(prev.current, next) : [];
    prev.current = next;
    setData(next);
    if (changed.length > 0) setHighlight(changed[changed.length - 1]);
  }, []);

  useEffect(() => {
    if (!demo) return;
    const refresh = () => void load();
    refresh();
    window.addEventListener(SANDBOX_REFRESH_EVENT, refresh);
    const timer = open ? window.setInterval(refresh, 1500) : undefined;
    return () => {
      window.removeEventListener(SANDBOX_REFRESH_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [demo, open, load]);

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [highlight]);

  if (!demo) return null;

  const lit = (id: string) => (highlight === id ? "border-primary/70 bg-primary/10" : "border-border bg-surface-2/40");

  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", !open && "-rotate-90")} />
          <span className="text-sm font-semibold">Sandbox</span>
          <span className="truncate text-xs text-muted">Where approved actions land in demo mode</span>
        </button>
        <ResetDemoButton />
      </div>

      {open && (
        <div className="grid gap-3 border-t border-border p-3 md:grid-cols-3">
          <Panel icon={<KanbanSquare className="h-3.5 w-3.5" />} title="Jira board">
            {COLUMNS.map((col) => {
              const items = data?.tickets.filter((t) => t.status === col) ?? [];
              return (
                <div key={col} className="mb-3 last:mb-0">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {col} <span className="font-normal">{items.length}</span>
                  </p>
                  <ul className="space-y-1">
                    {items.map((t) => (
                      <li key={t.key} className={cn("rounded-md border px-2 py-1.5 text-xs transition-colors duration-300", lit(t.key))}>
                        <span className="font-semibold text-primary-soft">{t.key}</span> <span className="text-fg">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Panel>

          <Panel icon={<Hash className="h-3.5 w-3.5" />} title="team-standup">
            <ul className="space-y-2">
              {data?.slack.map((m) => (
                <li key={m.id} className={cn("rounded-md border px-2.5 py-2 text-xs transition-colors duration-300", lit(m.id))}>
                  <p className="mb-0.5">
                    <span className="font-semibold text-fg">{m.author}</span> <span className="text-muted">{time(m.postedAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-fg/90">{m.text}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={<Inbox className="h-3.5 w-3.5" />} title="Outbox">
            {data && data.outbox.length === 0 ? (
              <p className="text-xs text-muted">Nothing sent yet. Emails appear here after you approve them.</p>
            ) : (
              <ul className="space-y-2">
                {data?.outbox.map((e) => (
                  <li key={e.id} className={cn("rounded-md border px-2.5 py-2 text-xs transition-colors duration-300", lit(e.id))}>
                    <p className="text-muted">
                      To {e.to} · {time(e.sentAt)}
                    </p>
                    <p className="font-semibold text-fg">{e.subject}</p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-fg/80">{e.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg/40 p-3">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon}
        {title}
      </p>
      <div className="max-h-80 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}
