"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Hash, KanbanSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { approve, dismiss, type PendingApproval } from "./api";
import { REVEAL, Section, UndoButton, refreshSandbox } from "./ui";

const ICON: Record<string, typeof Mail> = { send_email: Mail, post_slack: Hash, transition_ticket: KanbanSquare };

const str = (v: unknown) => (typeof v === "string" ? v : "");

function details(a: PendingApproval) {
  const draft = (a.draftContent && typeof a.draftContent === "object" ? a.draftContent : {}) as Record<string, unknown>;
  const subject = str(draft.subject) || str(a.payload.subject);
  const body = str(draft.body) || str(a.payload.body) || str(a.payload.text) || str(a.payload.comment);
  const to = str(a.payload.to);
  return { subject, body, to };
}

function ApprovalItem({
  item,
  approvedUntil,
  highlight,
  trace,
  onApprove,
  onUndone,
  onDismissed,
}: {
  item: PendingApproval;
  /** Set while the item is in its Undo window. */
  approvedUntil: string | null;
  highlight: boolean;
  trace: string | null;
  onApprove: () => Promise<void>;
  onUndone: () => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { subject, body, to } = details(item);
  const Icon = ICON[item.actionType] ?? Check;
  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={REVEAL}
      className={cn("rounded-lg border p-3.5 transition-colors duration-500", highlight ? "border-primary/60" : "border-border")}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.summary}</p>
          {(to || subject) && (
            <p className="mt-1 text-xs text-muted">
              {to && <span>To {to}</span>}
              {to && subject && <span> · </span>}
              {subject && <span className="text-fg/80">{subject}</span>}
            </p>
          )}
          {body && <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted">{body}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {approvedUntil ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs text-fg">
                  <Check className="h-3 w-3" />
                  Approved by click
                </span>
                <UndoButton actionId={item.id} until={approvedUntil} onUndone={onUndone} />
              </>
            ) : (
              <>
                <Button size="sm" disabled={busy} onClick={run(onApprove)}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={run(async () => (await dismiss(item.id), onDismissed()))}>
                  Dismiss
                </Button>
              </>
            )}
            {trace && (
              <Link href={`/runs/${trace}`} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                Trace
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.li>
  );
}

/** Everything waiting for the user's OK in this session. Nothing goes out without a click or a yes. */
export function NeedsYourOk({
  items,
  highlightId,
  active,
  traceFor,
  onChanged,
}: {
  items: PendingApproval[];
  highlightId?: string | null;
  active: boolean;
  traceFor: (actionId: string) => string | null;
  onChanged: () => void;
}) {
  // Approved items leave the pending list at once; keep them here through their Undo window.
  const [held, setHeld] = useState<Record<string, { item: PendingApproval; until: string }>>({});
  const release = useCallback((id: string) => setHeld(({ [id]: _gone, ...rest }) => (void _gone, rest)), []);

  useEffect(() => {
    const timers = Object.entries(held).map(([id, h]) =>
      window.setTimeout(() => {
        release(id);
        onChanged();
      }, Math.max(0, new Date(h.until).getTime() - Date.now() + 800))
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [held, release, onChanged]);

  const shown = [...items.filter((i) => !held[i.id]), ...Object.values(held).map((h) => h.item)].sort(
    (a, b) => Number(b.id === highlightId) - Number(a.id === highlightId)
  );

  return (
    <Section title="Needs your OK" active={active} aside={shown.length > 0 && <span className="text-xs tabular-nums text-muted">{shown.length}</span>}>
      {shown.length === 0 ? (
        <p className="text-xs text-muted">Nothing is waiting for you.</p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <ApprovalItem
                key={item.id}
                item={item}
                approvedUntil={held[item.id]?.until ?? null}
                highlight={active && item.id === highlightId}
                trace={traceFor(item.id)}
                onApprove={async () => {
                  const res = await approve(item.id, "click");
                  if (!res?.ok) return;
                  setHeld((h) => ({ ...h, [item.id]: { item, until: res.undoUntil ?? new Date(Date.now() + 5000).toISOString() } }));
                  refreshSandbox();
                }}
                onUndone={() => {
                  release(item.id);
                  onChanged();
                }}
                onDismissed={onChanged}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Section>
  );
}
