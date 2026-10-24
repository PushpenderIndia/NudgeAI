"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useLiveRun } from "@/components/graph/hooks";
import { StatusLine } from "@/components/briefing/StatusLine";
import { cn } from "@/lib/utils";
import { runStatus } from "./Stage";
import { REVEAL } from "./ui";

/** A prep or weekly-update run: live status while it works, the result once it is done. */
export function SideRunResult({ runId, onOpen, className }: { runId: string; onOpen: () => void; className?: string }) {
  const run = useLiveRun(runId, null, true);
  const working = runStatus(run) ?? (!run ? { agent: "Nudge" as const, text: "Starting…" } : null);
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={REVEAL} className={cn("rounded-lg border border-border bg-surface-2/30 p-3", className)}>
      {working ? (
        <StatusLine agent={working.agent} text={working.text} />
      ) : run?.status === "failed" ? (
        <p className="text-xs text-muted">That run stopped early. Open the trace to see where.</p>
      ) : (
        <p className="whitespace-pre-line text-xs leading-relaxed text-fg/85">{run?.summary || "Done."}</p>
      )}
      <button type="button" onClick={onOpen} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted hover:text-fg">
        View trace
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
