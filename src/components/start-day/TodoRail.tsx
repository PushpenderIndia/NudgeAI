"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Ticket } from "@/nudge/types";
import { isUrgent } from "./flow";
import { Dot, REVEAL, Section } from "./ui";

/** Remaining tickets, urgent first; amber marks urgent ones only. */
export function TodoRail({ tickets, active = false, children }: { tickets: Ticket[]; active?: boolean; children?: React.ReactNode }) {
  const sorted = [...tickets].sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)));
  return (
    <Section title="To-do" active={active} aside={<span className="text-xs tabular-nums text-muted">{tickets.length}</span>}>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted">Nothing else on your list.</p>
      ) : (
        <ul className="-mx-1 divide-y divide-border">
          <AnimatePresence initial={false}>
            {sorted.map((t) => (
              <motion.li key={t.key} layoutId={`ticket-${t.key}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={REVEAL} className="px-1 py-2.5">
                <a href={t.url} target="_blank" rel="noreferrer" className="group block">
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    <Dot tone={isUrgent(t) ? "urgent" : "idle"} />
                    <span className="font-medium text-fg/70">{t.key}</span>
                    <span>{t.priority}</span>
                    {t.estimateHours > 0 && <span>· {t.estimateHours}h</span>}
                    {t.status !== "To Do" && <span className="ml-auto">{t.status}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug group-hover:text-fg">{t.title}</span>
                  {t.notes && <span className="mt-0.5 block text-xs text-muted">{t.notes}</span>}
                </a>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {children}
    </Section>
  );
}
