"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Controls, ReactFlow, type NodeTypes } from "@xyflow/react";
import type { RunView } from "@/lib/agent-runs";
import type { AgentName } from "@/nudge/types";
import { cn } from "@/lib/utils";
import { AgentDrawer } from "./AgentDrawer";
import { AgentNode } from "./AgentNode";
import { useLiveRun, usePacedRun, useRunGraph } from "./hooks";

export { usePacedSteps, usePacedRun, useRunGraph, useLiveRun, deriveHandoffs, AGENT_LAYOUT } from "./hooks";
export type { AgentNodeData, AgentNodeState, Handoff } from "./hooks";

export type AgentGraphVariant = "full" | "panel" | "page";

export type AgentGraphProps = {
  runId: string;
  variant: AgentGraphVariant;
  initial?: RunView | null;
  /** Keep following the run (SSE, then 500 ms polling) and pace fast steps for display. */
  live?: boolean;
  onNodeClick?: (agent: AgentName) => void;
  /** Use this run instead of fetching one (e.g. a parent that already follows it). */
  run?: RunView | null;
  /** Open the steps drawer on node click (default true). */
  drawer?: boolean;
  className?: string;
};

const nodeTypes: NodeTypes = { agent: AgentNode };

const HEIGHT: Record<AgentGraphVariant, string> = {
  full: "h-full min-h-[520px]",
  panel: "h-[440px]",
  page: "h-[540px]",
};

// React Flow themed with our tokens: transparent canvas, thin edges, quiet labels.
const THEME = {
  "--xy-background-color": "transparent",
  "--xy-node-background-color": "transparent",
  "--xy-node-border": "none",
  "--xy-node-boxshadow-hover": "none",
  "--xy-node-boxshadow-selected": "none",
  "--xy-edge-stroke": "var(--border)",
  "--xy-edge-label-background-color": "var(--bg)",
  "--xy-edge-label-color": "var(--muted)",
  "--xy-controls-button-background-color": "var(--surface)",
  "--xy-controls-button-background-color-hover": "var(--surface-2)",
  "--xy-controls-button-color": "var(--muted)",
  "--xy-controls-button-color-hover": "var(--fg)",
  "--xy-controls-button-border-color": "var(--border)",
  "--xy-controls-box-shadow": "none",
} as CSSProperties;

/**
 * The agent team for one run: Nudge in the centre, the six specialists around it.
 * Read-only; nodes light up as they work and edges animate on each handoff.
 */
export function AgentGraph({ runId, variant, initial = null, live = false, onNodeClick, run: given, drawer = true, className }: AgentGraphProps) {
  const controlled = given !== undefined;
  const followed = useLiveRun(controlled ? null : runId, initial, live && !controlled);
  const run = usePacedRun(controlled ? given : followed, live ? 600 : 0);
  const { nodes, edges } = useRunGraph(run);
  const [selected, setSelected] = useState<AgentName | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const open = useCallback(
    (agent: AgentName) => {
      setSelected(agent);
      if (drawer) setDrawerOpen(true);
      onNodeClick?.(agent);
    },
    [drawer, onNodeClick]
  );
  const compact = variant === "panel";
  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, compact, onOpen: open } })), [nodes, compact, open]);
  const interactive = variant === "page";

  return (
    <div className={cn("relative w-full", HEIGHT[variant], className)} style={THEME}>
      <ReactFlow
        nodes={shown}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: variant === "full" ? 0.12 : 0.08 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        preventScrolling={interactive}
        proOptions={{ hideAttribution: true }}
        aria-label="Agent graph"
      >
        {interactive && <Controls showInteractive={false} position="bottom-right" className="overflow-hidden rounded-lg border border-border" />}
      </ReactFlow>
      {drawer && <AgentDrawer run={run} agent={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />}
    </div>
  );
}
