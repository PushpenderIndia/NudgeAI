"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFinished, type RunView } from "@/lib/agent-runs";
import { AgentGraph } from "./AgentGraph";
import { HandoffChain } from "./HandoffChain";

export type AgentGraphPanelProps = {
  runId: string;
  /** The run as the page already has it; the panel follows it if it is still going. */
  run?: RunView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows a Replay button (re-speaks the saved briefing). */
  onReplay?: () => void;
};

/** "How I planned this": the finished run's agent graph in a side sheet. */
export function AgentGraphPanel({ runId, run = null, open, onOpenChange, onReplay }: AgentGraphPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/60 animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col border-l border-border bg-bg animate-fade-in focus:outline-none">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">{run?.title ?? "How I planned this"}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-0.5 text-xs text-muted">
                  {run ? <HandoffChain run={run} /> : "Loading…"}
                </div>
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {open && <AgentGraph runId={runId} initial={run} variant="panel" live={!isFinished(run)} />}
            <p className="px-2 pt-2 text-xs text-muted">Select an agent to see its steps, tools and what it handed off.</p>
          </div>
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            {onReplay && (
              <Button size="sm" variant="secondary" onClick={onReplay}>
                <RotateCcw className="h-3.5 w-3.5" />Replay
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild className="ml-auto">
              <Link href={`/runs/${runId}`}>
                Full trace<ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
