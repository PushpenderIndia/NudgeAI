"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, GitPullRequest } from "lucide-react";
import type { Mismatch } from "@/nudge/briefing";
import type { ConfirmState } from "./flow";
import { REVEAL, Section, UndoButton } from "./ui";

const viaLabel = (via: ConfirmState["via"]) => (via === "voice" ? "by voice" : "by click");

/** Scene 2: the ticket whose status disagrees with its open PR, and what happened to it. */
export function CatchCard({
  mismatch,
  state,
  undone,
  active,
  onUndone,
}: {
  mismatch: Mismatch;
  state: ConfirmState | null;
  undone: boolean;
  active: boolean;
  onUndone: () => void;
}) {
  const { ticket, pr } = mismatch;
  const approved = state?.decision === "confirm" && !undone;
  return (
    <Section title="Ticket check" active={active}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <a href={ticket.url} target="_blank" rel="noreferrer" className="hover:text-fg">
              {ticket.key}
            </a>
          </p>
          <p className="mt-0.5 text-sm font-medium">{ticket.title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              approved
                ? "rounded-md border border-border px-2 py-0.5 text-muted line-through"
                : "rounded-md border border-primary/60 bg-primary/10 px-2 py-0.5 text-primary-soft"
            }
          >
            {ticket.status}
          </span>
          {approved && <span className="rounded-md border border-border px-2 py-0.5 text-fg">{mismatch.suggestedStatus}</span>}
          <span className="text-muted">but</span>
          <a href={pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/10 px-2 py-0.5 text-primary-soft">
            <GitPullRequest className="h-3 w-3" />
            PR #{pr.number} {pr.state}
          </a>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {state && (
          <motion.div
            key={`${state.decision}-${undone}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={REVEAL}
            className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm"
          >
            {approved ? (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-fg">
                  <Check className="h-3 w-3" />
                </span>
                <span>
                  Approved {viaLabel(state.via)} · {ticket.key} moves to {mismatch.suggestedStatus}
                </span>
                <span className="ml-auto">
                  <UndoButton actionId={mismatch.pendingActionId} until={state.undoUntil} onUndone={onUndone} />
                </span>
              </>
            ) : undone ? (
              <span className="text-muted">Undone. {ticket.key} stays {ticket.status}.</span>
            ) : state.skipped ? (
              <span className="text-muted">Skipped. The move is still waiting in Needs your OK.</span>
            ) : (
              <span className="text-muted">
                Left as {ticket.status} — noted in your standup.
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
