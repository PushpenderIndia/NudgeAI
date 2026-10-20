"use client";

import { useState, useEffect, useRef } from "react";
import { Bell as BellIcon, Clock, CalendarCheck, FileText } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { showToast } from "@/lib/toast";
import { cn, formatTime } from "@/lib/utils";

interface Notif {
  id: string;
  message: string;
  createdAt: string | null;
}

const RUNNERS: { kind: "timesheet" | "eod" | "weekly"; label: string; icon: typeof Clock }[] = [
  { kind: "timesheet", label: "Timesheet", icon: Clock },
  { kind: "eod", label: "End of day", icon: CalendarCheck },
  { kind: "weekly", label: "Weekly report", icon: FileText },
];

export function Bell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function run(kind: "timesheet" | "eod" | "weekly") {
    const res = await fetch("/api/scheduler/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, "nudge");
      load();
    }
  }

  const hasUnread = notifs.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-muted hover:text-fg"
        aria-label="Notifications"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {hasUnread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-nudge glow-nudge" />}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-72 rounded-2xl border border-border bg-surface p-3 shadow-xl animate-fade-up">
          <div className="mb-2 flex items-center gap-2">
            <OwlMark size={18} />
            <p className="text-sm font-semibold">Nudge&rsquo;s nudges</p>
          </div>

          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted">No reminders yet. Try one below.</p>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className="rounded-lg bg-surface-2/50 px-2.5 py-2 text-xs text-fg/90">
                  {n.message}
                  {n.createdAt && <span className="ml-1 text-muted">· {formatTime(n.createdAt)}</span>}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Try a reminder now</p>
            <div className="grid grid-cols-3 gap-1">
              {RUNNERS.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.kind}
                    onClick={() => run(r.kind)}
                    className={cn("flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-2/40 px-1 py-2 text-[10px] text-muted hover:text-fg hover:bg-surface-2")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
