"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { isFinished, type RunView, type StepView } from "@/lib/agent-runs";
import { AGENT_JOBS, AGENT_NAMES, type AgentName } from "@/nudge/types";
import { useRunStream } from "@/components/today/hooks";

export type AgentNodeState = "idle" | "working" | "done" | "failed";

export type AgentNodeData = {
  agent: AgentName;
  job: string;
  state: AgentNodeState;
  /** One of this agent's steps found something urgent (stays on, subtly, after it finishes). */
  urgent: boolean;
  narration: string;
  stepCount: number;
  compact?: boolean;
  onOpen?: (agent: AgentName) => void;
};
export type AgentNode = Node<AgentNodeData, "agent">;

/** Hand-placed radial layout (node centres): the plan_day pipeline runs clockwise from Historian. */
export const AGENT_LAYOUT: Record<AgentName, { x: number; y: number }> = {
  Nudge: { x: 0, y: 0 },
  Historian: { x: -300, y: -150 },
  Tracker: { x: 0, y: -250 },
  Planner: { x: 300, y: -150 },
  Reporter: { x: 300, y: 150 },
  Courier: { x: 0, y: 250 },
  Scribe: { x: -300, y: 150 },
};

const SPECIALISTS = AGENT_NAMES.filter((a) => a !== "Nudge");
const isAgent = (name: string): name is AgentName => (AGENT_NAMES as readonly string[]).includes(name);
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** How long an edge keeps animating after its handoff settles. */
const LINGER_MS = 1200;

export type Handoff = { from: AgentName; to: AgentName; index: number; inProgress: boolean };

/** Handoffs seen in the steps: a finished step's handoffTo (or the next step's agent when it differs). */
export function deriveHandoffs(run: Pick<RunView, "status" | "steps">): Handoff[] {
  const { steps } = run;
  const out: Handoff[] = [];
  steps.forEach((step, i) => {
    const next = steps[i + 1];
    const to = step.handoffTo ?? next?.agent;
    if (!to || to === step.agent || !isAgent(to) || !isAgent(step.agent)) return;
    if (step.status === "running" && !next) return;
    const target = next?.agent === to ? next : undefined;
    const inProgress = run.status === "running" && step.status !== "running" && (!next || target?.status === "running");
    out.push({ from: step.agent, to, index: i, inProgress });
  });
  return out;
}

/**
 * Nodes, edges and narration for a run. Violet = working, amber = found something
 * urgent, grey = idle or done; an edge animates only while its handoff is happening.
 */
export function useRunGraph(run: RunView | null) {
  const steps = useMemo(() => run?.steps ?? [], [run]);
  const handoffs = useMemo(() => (run ? deriveHandoffs(run) : []), [run]);
  const active = handoffs.findLast((h) => h.inProgress) ?? null;
  const activeKey = active ? pairKey(active.from, active.to) : null;

  const [linger, setLinger] = useState<string | null>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = activeKey;
    if (!was || was === activeKey) return;
    const show = setTimeout(() => setLinger(was), 0);
    setTimeout(() => setLinger((k) => (k === was ? null : k)), LINGER_MS);
    return () => clearTimeout(show);
  }, [activeKey]);

  return useMemo(() => {
    const running = run?.status === "running" ? steps.findLast((s) => s.status === "running") : undefined;
    const activeAgent: AgentName | null = running && isAgent(running.agent) ? running.agent : active?.to ?? null;

    const narrationByAgent: Partial<Record<AgentName, string>> = {};
    const nodes: AgentNode[] = AGENT_NAMES.map((agent) => {
      const own = steps.filter((s) => s.agent === agent);
      const latest = own.at(-1);
      if (latest) narrationByAgent[agent] = latest.narration || (latest.status === "running" ? `${latest.phase}…` : latest.phase);
      if (!latest && agent === activeAgent) narrationByAgent[agent] = "Picking this up…";
      const state: AgentNodeState =
        agent === activeAgent ? "working" : latest?.status === "failed" ? "failed" : latest ? "done" : "idle";
      return {
        id: agent,
        type: "agent",
        position: AGENT_LAYOUT[agent],
        origin: [0.5, 0.5],
        data: {
          agent,
          job: AGENT_JOBS[agent],
          state,
          urgent: own.some((s) => s.foundItems.some((f) => f.urgent)),
          narration: narrationByAgent[agent] ?? "",
          stepCount: own.length,
        },
      };
    });

    const pairs = new Map<string, { source: AgentName; target: AgentName; count: number }>();
    for (const agent of SPECIALISTS) pairs.set(pairKey("Nudge", agent), { source: "Nudge", target: agent, count: 0 });
    for (const h of handoffs) {
      const key = pairKey(h.from, h.to);
      const pair = pairs.get(key);
      pairs.set(key, { source: h.from, target: h.to, count: (pair?.count ?? 0) + 1 });
    }
    const edges: Edge[] = [...pairs.entries()].map(([key, { source, target, count }]) => {
      const animated = key === activeKey || key === linger;
      return {
        id: key,
        source,
        target,
        type: "straight",
        animated,
        selectable: false,
        focusable: false,
        label: count > 0 && !animated ? `${count} ${count === 1 ? "handoff" : "handoffs"}` : undefined,
        style: animated
          ? { stroke: "var(--primary)", strokeWidth: 1.5 }
          : count > 0
            ? { stroke: "var(--muted)", strokeOpacity: 0.55, strokeWidth: 1 }
            : { stroke: "var(--border)", strokeOpacity: 0.6, strokeWidth: 1, strokeDasharray: "2 4" },
        zIndex: animated ? 1 : 0,
      };
    });

    return { nodes, edges, activeAgent, narrationByAgent, handoffs };
  }, [run, steps, handoffs, active, activeKey, linger]);
}

/**
 * Display pacing only: steps that arrive faster than `minMs` apart are revealed
 * one at a time, at least `minMs` apart. Steps present on mount show at once.
 */
export function usePacedSteps(steps: StepView[], minMs = 600): StepView[] {
  const [paced, setPaced] = useState(() => ({ count: steps.length, at: 0 }));
  const pending = minMs > 0 && paced.count < steps.length;
  useEffect(() => {
    if (!pending) return;
    const wait = Math.max(0, minMs - (Date.now() - paced.at));
    const timer = setTimeout(() => setPaced((p) => ({ count: p.count + 1, at: Date.now() })), wait);
    return () => clearTimeout(timer);
  }, [pending, paced, minMs]);
  return useMemo(() => (minMs > 0 ? steps.slice(0, Math.min(paced.count, steps.length)) : steps), [steps, paced.count, minMs]);
}

/** The run with only the paced steps; it reads as running until every step is shown. */
export function usePacedRun(run: RunView | null, minMs = 600): RunView | null {
  const steps = usePacedSteps(run?.steps ?? EMPTY, minMs);
  return useMemo(() => {
    if (!run) return null;
    if (steps.length >= run.steps.length) return run;
    return { ...run, steps, status: "running" };
  }, [run, steps]);
}
const EMPTY: StepView[] = [];

const POLL_MS = 500;

/**
 * Follows a run: SSE while it runs, then (when `live`) polls /api/runs/[id] every
 * 500 ms so runs that gain steps or go back to running after "done" keep moving.
 */
export function useLiveRun(runId: string | null, initial: RunView | null, live: boolean): RunView | null {
  const streamed = useRunStream(runId, initial);
  const [polled, setPolled] = useState<RunView | null>(null);
  const current = polled && polled.id === runId ? polled : null;
  const poll = live && Boolean(runId) && (Boolean(current) || isFinished(streamed));

  useEffect(() => {
    if (!poll || !runId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let last = "";
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (res.ok) {
          const text = await res.text();
          if (!stopped && text !== last) {
            last = text;
            setPolled(JSON.parse(text) as RunView);
          }
        }
      } catch {
        // Keep polling; a dropped request just waits for the next tick.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [poll, runId]);

  return current ?? streamed;
}
