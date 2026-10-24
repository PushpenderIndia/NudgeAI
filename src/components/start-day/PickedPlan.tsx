"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pin } from "lucide-react";
import type { Pick, PlanBlock } from "@/nudge/briefing";
import { cn } from "@/lib/utils";
import { isUrgent } from "./flow";
import { Dot, REVEAL, Section, hhmm } from "./ui";

function PickCard({
  pick,
  index,
  pinned,
  selectable,
  onChoose,
}: {
  pick: Pick;
  index?: number;
  pinned?: boolean;
  selectable?: boolean;
  onChoose?: (id: string) => void;
}) {
  const urgent = isUrgent(pick.ticket) || pick.tags.includes("escalation");
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted">
        {urgent && <Dot tone="urgent" />}
        <span className="font-medium text-fg/80">{pick.id}</span>
        <span>· {pick.ticket.priority}</span>
        <span>· {pick.ticket.estimateHours}h</span>
        {pinned && (
          <span className="ml-auto inline-flex items-center gap-1 text-primary-soft">
            <Pin className="h-3 w-3" />
            Picked task
          </span>
        )}
        {!pinned && index !== undefined && <span className="ml-auto tabular-nums">{index + 1}</span>}
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{pick.ticket.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{pick.reason}</p>
    </>
  );
  const className = cn(
    "block w-full rounded-lg border bg-surface p-3.5 text-left",
    pinned ? "border-primary/50" : "border-border",
    selectable && "cursor-pointer transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
  );
  return (
    <motion.div layoutId={`ticket-${pick.id}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={REVEAL}>
      {selectable ? (
        <button type="button" className={className} onClick={() => onChoose?.(pick.id)}>
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </motion.div>
  );
}

/** Calendar events in grey, picked tasks in violet; amber only marks the urgent pick. */
export function PlanTimeline({ plan, urgentKeys, className }: { plan: PlanBlock[]; urgentKeys: string[]; className?: string }) {
  const blocks = plan.filter((p) => p.kind !== "free");
  if (!blocks.length) return <p className="text-xs text-muted">Nothing on the calendar today.</p>;
  return (
    <ol className={cn("space-y-1.5", className)} aria-label="Today's plan">
      {blocks.map((block, i) => {
        const task = block.kind === "task";
        const urgent = task && block.ticketKey && urgentKeys.includes(block.ticketKey);
        return (
          <motion.li
            key={`${block.start}-${block.title}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...REVEAL, delay: i * 0.08 }}
            className="flex items-stretch gap-3 text-sm"
          >
            <span className="w-24 shrink-0 pt-1.5 text-xs tabular-nums text-muted">
              {hhmm(block.start)}–{hhmm(block.end)}
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-2 px-3 py-1.5",
                task ? "border-primary bg-primary/10 text-fg" : "border-border bg-surface-2/50 text-muted"
              )}
            >
              {urgent && <Dot tone="urgent" />}
              {block.ticketKey && <span className="shrink-0 text-xs font-medium text-primary-soft">{block.ticketKey}</span>}
              <span className="truncate">{block.title}</span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

/**
 * Picked task & plan. While choosing: the three picks slide in as Nudge names them. Once
 * chosen: the pick is pinned and the others go back to the To-do rail (shared layout ids).
 */
export function PickedPlan({
  picks,
  pickId,
  plan,
  revealed,
  choosing,
  showPlan,
  picksActive,
  planActive,
  onChoose,
}: {
  picks: Pick[];
  pickId: string | null;
  plan: PlanBlock[];
  /** How many pick cards are named so far. */
  revealed: number;
  /** The choice is open: cards answer it on click. */
  choosing: boolean;
  showPlan: boolean;
  picksActive: boolean;
  planActive: boolean;
  onChoose?: (id: string) => void;
}) {
  const chosen = picks.find((p) => p.id === pickId) ?? null;
  const urgentKeys = picks.filter((p) => isUrgent(p.ticket) || p.tags.includes("escalation")).map((p) => p.id);
  if (!picks.length) return null;
  return (
    <Section title="Picked task & plan" active={picksActive || planActive}>
      {chosen ? (
        <PickCard pick={chosen} pinned />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <AnimatePresence>
              {picks.slice(0, revealed).map((pick, i) => (
                <PickCard key={pick.id} pick={pick} index={i} selectable={choosing && Boolean(onChoose)} onChoose={onChoose} />
              ))}
            </AnimatePresence>
          </div>
          {choosing && revealed >= picks.length && <p className="mt-3 text-xs text-muted">Choose one to start with. The other two stay on your to-do list.</p>}
        </>
      )}
      {showPlan && (chosen || !choosing) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={REVEAL} className="mt-4 border-t border-border pt-4">
          <PlanTimeline plan={plan} urgentKeys={urgentKeys} />
        </motion.div>
      )}
    </Section>
  );
}
