"use client";

import { motion } from "framer-motion";
import { RotateCcw, Waypoints } from "lucide-react";
import type { RunView } from "@/lib/agent-runs";
import { Button } from "@/components/ui/button";
import { HandoffChain } from "@/components/graph/HandoffChain";
import { StatusLine } from "@/components/briefing/StatusLine";
import { cn } from "@/lib/utils";
import { runStatus } from "./Stage";
import { REVEAL } from "./ui";

/** The agent graph collapsed into one row: handoff chain, duration, View trace and Replay. */
export function HowIPlanned({
  run,
  active,
  onViewTrace,
  onReplay,
}: {
  run: RunView;
  active: boolean;
  onViewTrace: () => void;
  onReplay?: () => void;
}) {
  const working = runStatus(run);
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scaleY: 1.6, y: 12 }}
      animate={{ opacity: 1, scaleY: 1, y: 0 }}
      transition={{ ...REVEAL, duration: 0.3 }}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-[border-color] duration-500",
        active ? "border-primary/60" : "border-border"
      )}
    >
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Waypoints className="h-3.5 w-3.5" />
        How I planned this
      </span>
      <div className="min-w-0 flex-1">
        {working ? <StatusLine agent={working.agent} text={working.text} /> : run.status === "failed" ? <p className="text-xs text-muted">This run stopped early.</p> : <HandoffChain run={run} />}
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onViewTrace}>
          View trace
        </Button>
        {onReplay && (
          <Button size="sm" variant="secondary" onClick={onReplay}>
            <RotateCcw className="h-3.5 w-3.5" />
            Replay
          </Button>
        )}
      </div>
    </motion.div>
  );
}
