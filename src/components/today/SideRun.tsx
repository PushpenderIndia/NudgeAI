"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RUN_DONE, RUN_STEP_COUNT, RUN_SUBJECT, isFinished, type RunView } from "@/lib/agent-runs";
import { AgentIcon } from "./AgentIcon";
import { StepTimeline } from "./StepTimeline";
import { usePlayback, usePrefersReducedMotion } from "./hooks";

function currentAgent(run: RunView) {
  return run.steps.findLast((s) => s.status === "running")?.agent ?? run.steps.at(-1)?.agent ?? "Nudge";
}

/** State C: a slim banner while a new run works, e.g. "Courier is working on a new urgent email…". */
export function SideRunBanner({ run, onWatch, onDismiss }: { run: RunView; onWatch: () => void; onDismiss: () => void }) {
  const done = isFinished(run);
  const agent = currentAgent(run);
  const subject = RUN_SUBJECT[run.type] ?? "something new";
  return (
    <div role="status" className="mb-6 flex items-center gap-3 border-y border-border py-2.5 animate-fade-up">
      <AgentIcon agent={done ? "Nudge" : agent} state={done ? "done" : "working"} size={24} />
      <p className="min-w-0 flex-1 truncate text-sm">
        {done ? (
          <>
            <span className="text-fg">{RUN_DONE[run.type] ?? "Finished."}</span>{" "}
            <span className="text-muted">{run.status === "waiting_for_user" ? "There’s something new waiting for your OK." : "Your list is up to date."}</span>
          </>
        ) : (
          <><span className="text-fg">{agent}</span> <span className="text-muted">is working on {subject}…</span></>
        )}
      </p>
      <Button size="sm" variant="ghost" onClick={onWatch}>{done ? "See how" : "Watch"}</Button>
      {done && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-1 text-muted hover:text-fg">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Side drawer with the same narrated stream as State A. */
export function SideRunDrawer({ run, open, onOpenChange }: { run: RunView | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/60 animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-border bg-bg shadow-none animate-fade-in focus:outline-none">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">{run?.title ?? "Agent run"}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted">
                {run ? (isFinished(run) ? "Finished" : "Working now") : "Loading…"}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">{run && <DrawerTimeline key={run.id} run={run} />}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DrawerTimeline({ run }: { run: RunView }) {
  const reduced = usePrefersReducedMotion();
  const playback = usePlayback(run.steps, isFinished(run), reduced);
  const total = Math.max(RUN_STEP_COUNT[run.type] ?? run.steps.length, run.steps.length);
  if (run.steps.length === 0) return <p className="text-sm text-muted animate-agent-pulse">Getting started…</p>;
  return (
    <>
      <p className="mb-5 text-xs text-muted">Step {Math.min(playback.index + 1, total)} of {total}</p>
      <StepTimeline steps={run.steps} playback={playback} />
    </>
  );
}
