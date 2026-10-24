"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isFinished } from "@/lib/agent-runs";
import { PlanningView } from "./PlanningView";
import { PlanView } from "./PlanView";
import { SideRunBanner, SideRunDrawer } from "./SideRun";
import { SimulateMenu, type SimulateKind } from "./SimulateMenu";
import { useRunStream } from "./hooks";
import type { TodayData } from "./types";

const SEEN_KEY = "nudge:plan-seen";

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function markSeen(runId: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, runId);
  } catch {
    // Storage blocked; the plan just replays next time.
  }
}
const noopSubscribe = () => () => {};

/**
 * Today is a small state machine:
 *   planning (State A) — the owl and the narrated run, live or replayed
 *   plan (State B)     — "How I planned this" plus insights, approvals and tasks
 * The first open of each plan shows State A; after that the plan is shown directly.
 */
export function TodayExperience(props: TodayData) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [planRunId, setPlanRunId] = useState(props.planRun?.id ?? null);
  const plan = useRunStream(planRunId, props.planRun);
  const [mode, setMode] = useState<"auto" | "planning" | "plan">("auto");
  const [replayKey, setReplayKey] = useState(0);
  const [starting, setStarting] = useState(false);

  // State C: another run (urgent email, meeting ended) working alongside the plan.
  const [sideRunId, setSideRunId] = useState(props.sideRun?.id ?? null);
  const side = useRunStream(sideRunId, props.sideRun);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/run?since=${mountedAt - 60000}`);
        const data = (await res.json()) as { runs: { id: string; trigger: string; status: string }[] };
        const fresh = data.runs.find((r) => r.trigger !== "plan_day" && r.status === "running");
        if (fresh) setSideRunId((current) => current ?? fresh.id);
      } catch {
        // Offline for a moment; try again on the next tick.
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [mountedAt]);
  const sideRefreshed = useRef<string | null>(null);
  useEffect(() => {
    if (side && isFinished(side) && sideRefreshed.current !== side.id) {
      sideRefreshed.current = side.id;
      router.refresh();
    }
  }, [side, router]);

  // Server snapshot says "seen" so the first paint matches; the client then decides.
  const seen = useSyncExternalStore(noopSubscribe, () => readSeen() === planRunId, () => true);
  const view = mode !== "auto" ? mode : plan && (!isFinished(plan) || !seen) ? "planning" : "plan";

  // Fresh results land in the plan as soon as the run finishes.
  const refreshed = useRef<string | null>(isFinished(props.planRun) ? props.planRun!.id : null);
  useEffect(() => {
    if (plan && isFinished(plan) && refreshed.current !== plan.id) {
      refreshed.current = plan.id;
      router.refresh();
    }
  }, [plan, router]);

  function showPlan() {
    if (planRunId) markSeen(planRunId);
    setMode("plan");
  }

  function replay() {
    setReplayKey((k) => k + 1);
    setMode("planning");
  }

  async function planAgain() {
    setStarting(true);
    try {
      const res = await fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow: "plan_day" }) });
      const data = await res.json();
      if (data.runId) followPlan(data.runId);
    } finally {
      setStarting(false);
    }
  }

  function followPlan(runId: string) {
    setPlanRunId(runId);
    setReplayKey((k) => k + 1);
    setMode("planning");
  }

  function onSimulated(kind: SimulateKind, runId: string) {
    if (kind === "plan_day") return followPlan(runId);
    setSideRunId(runId);
  }

  const duration = reduceMotion ? 0 : 0.25;
  return (
    <div className="relative">
      {props.demoMode && (
        <div className="absolute right-0 top-0 z-10">
          <SimulateMenu onStarted={onSimulated} />
        </div>
      )}
      {side && (
        <div className={props.demoMode ? "pt-10" : undefined}>
          <SideRunBanner run={side} onWatch={() => setDrawerOpen(true)} onDismiss={() => setSideRunId(null)} />
        </div>
      )}
      <SideRunDrawer run={side} open={drawerOpen && Boolean(side)} onOpenChange={setDrawerOpen} />
      <AnimatePresence mode="wait" initial={false}>
        {view === "planning" ? (
          <motion.div
            key={`planning-${replayKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration } }}
            exit={{ opacity: 0, height: 0, transition: { duration: reduceMotion ? 0 : 0.35, ease: "easeInOut" } }}
            style={{ overflow: "hidden" }}
          >
            <PlanningView run={plan} onSkip={showPlan} onComplete={showPlan} />
          </motion.div>
        ) : (
          <motion.div key="plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration } }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <PlanView
              userName={props.userName}
              dateLabel={props.dateLabel}
              plan={plan}
              insights={plan && plan.id !== props.planRun?.id ? [] : props.insights}
              approvals={props.approvals}
              tasks={props.tasks}
              meetings={props.meetings}
              onReplay={replay}
              onWatch={() => setMode("planning")}
              onPlanAgain={planAgain}
              planning={starting}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
