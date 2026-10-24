"use client";

import { motion } from "framer-motion";
import type { RunView } from "@/lib/agent-runs";
import type { AgentName } from "@/nudge/types";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/briefing/Caption";
import { OwlAvatar, type OwlState } from "@/components/briefing/OwlAvatar";
import { StatusLine } from "@/components/briefing/StatusLine";
import { AgentGraph } from "@/components/graph/AgentGraph";
import { REVEAL } from "./ui";

export type Line = { text: string; highlights: string[]; spokenChars?: number };

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Tracker is checking PRs and tickets…" from the step a run is on right now. */
export function runStatus(run: RunView | null | undefined): { agent: AgentName; text: string } | null {
  if (!run || run.status !== "running") return null;
  const step = [...run.steps].reverse().find((s) => s.status === "running") ?? run.steps.at(-1);
  if (!step) return { agent: "Nudge", text: "Nudge is getting the team together…" };
  return { agent: step.agent as AgentName, text: `${step.agent} is ${lowerFirst(step.phase)}…` };
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] ?? "";

function Owl({ state, size, urgent }: { state: OwlState; size: number; urgent?: boolean }) {
  return (
    <motion.div layoutId="nudge-owl" transition={REVEAL} className="inline-flex">
      <OwlAvatar state={state} size={size} urgent={urgent} />
    </motion.div>
  );
}

/** Scene 0: the owl centred, the welcome line, Start my day and a quiet Skip intro. */
export function WelcomeStage({
  line,
  owl,
  onStart,
  onSkip,
  audioHint,
}: {
  line: Line;
  owl: OwlState;
  /** Absent while the welcome scene is being replayed. */
  onStart?: () => void;
  onSkip?: () => void;
  audioHint?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-bg px-6 text-center">
      <Owl state={owl} size={128} />
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...REVEAL, delay: 0.1 }} className="mt-8 max-w-lg">
        <Caption text={line.text} highlights={line.highlights} spokenChars={line.spokenChars ?? line.text.length} className="text-xl font-medium leading-relaxed md:text-2xl" />
      </motion.div>
      {audioHint}
      {onStart && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...REVEAL, delay: 0.25 }} className="mt-10 flex flex-col items-center gap-4">
          <Button size="lg" onClick={onStart} autoFocus>
            Start my day
          </Button>
          {onSkip && (
            <button type="button" onClick={onSkip} className="cursor-pointer text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
              Skip intro
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

/** Scene 1: the agent graph fills the screen on the real run while the team works. */
export function TeamStage({
  runId,
  run,
  line,
  owl,
  status,
  onSkip,
  audioHint,
}: {
  runId: string | null;
  run: RunView | null;
  line: Line | null;
  owl: OwlState;
  status: { agent: AgentName; text: string } | null;
  onSkip?: () => void;
  audioHint?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg">
      <div className="flex flex-col items-center gap-3 px-6 pt-8 text-center md:pt-10">
        <Owl state={owl} size={64} />
        <div className="min-h-[1.75rem] max-w-xl">
          {line && <Caption text={line.text} highlights={line.highlights} spokenChars={line.spokenChars ?? line.text.length} className="text-base md:text-lg" />}
        </div>
        <div className="min-h-4">{status && <StatusLine agent={status.agent} text={status.text} />}</div>
        {audioHint}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="min-h-0 flex-1 px-2 pb-24">
        {runId && <AgentGraph runId={runId} run={run} variant="full" live className="h-full min-h-0" />}
      </motion.div>
      {onSkip && (
        <button type="button" onClick={onSkip} className="absolute right-5 top-5 cursor-pointer text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
          Skip intro
        </button>
      )}
    </div>
  );
}
