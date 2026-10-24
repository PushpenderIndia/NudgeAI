"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { SANDBOX_REFRESH_EVENT } from "@/lib/demo-client";
import { usePrefersReducedMotion } from "@/components/today/hooks";
import { cn } from "@/lib/utils";
import { undo } from "./api";

export const REVEAL = { duration: 0.25, ease: [0.2, 0.7, 0.3, 1] } as const;

/** "14:00" in the viewer's clock. */
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const refreshSandbox = () => window.dispatchEvent(new Event(SANDBOX_REFRESH_EVENT));

/**
 * A page section that fades/slides in when revealed and carries a soft violet outline
 * while Nudge is talking about it (the outline fades when the next scene starts).
 */
export function Section({
  title,
  aside,
  active = false,
  className,
  children,
  id,
}: {
  title?: string;
  aside?: React.ReactNode;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [active, reduced]);
  return (
    <motion.section
      ref={ref}
      id={id}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={REVEAL}
      className={cn(
        "scroll-mt-40 rounded-xl border p-4 transition-[border-color,box-shadow] duration-500 md:p-5",
        active ? "border-primary/60 shadow-[0_0_0_3px_rgba(123,108,246,0.12)]" : "border-border",
        className
      )}
    >
      {(title || aside) && (
        <div className="mb-3 flex items-center gap-3">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>}
          {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}

/** Seconds left until an ISO deadline, ticking once a second. */
export function useCountdown(untilISO?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  const until = untilISO ? new Date(untilISO).getTime() : 0;
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

/** Undo for an approved action during its 5 s window; refreshes the Sandbox when it lands. */
export function UndoButton({ actionId, until, onUndone }: { actionId: string; until?: string | null; onUndone: () => void }) {
  const left = useCountdown(until);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!until) return;
    const ms = new Date(until).getTime() - Date.now() + 600;
    const timer = window.setTimeout(refreshSandbox, Math.max(0, ms));
    return () => window.clearTimeout(timer);
  }, [until]);
  if (!until || left <= 0) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await undo(actionId);
        setBusy(false);
        if (res?.ok) {
          onUndone();
          refreshSandbox();
        }
      }}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <RotateCcw className="h-3 w-3" />
      Undo <span className="tabular-nums text-muted">{left}s</span>
    </button>
  );
}

export function Dot({ tone }: { tone: "urgent" | "active" | "idle" }) {
  return (
    <span
      aria-hidden
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone === "urgent" ? "bg-nudge" : tone === "active" ? "bg-primary" : "bg-muted/50")}
    />
  );
}
