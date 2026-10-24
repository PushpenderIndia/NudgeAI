"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { OwlMark } from "@/components/NudgeLogo";
import { AGENT_ICONS } from "@/components/today/AgentIcon";
import { cn } from "@/lib/utils";
import type { AgentNode as AgentNodeType } from "./hooks";

// Edges are straight lines between node centres, drawn underneath the cards.
const CENTRE = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" } as const;
const HANDLE = "!pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

function AgentNodeView({ data }: NodeProps<AgentNodeType>) {
  const { agent, job, state, urgent, narration, compact, onOpen } = data;
  const working = state === "working";
  const hub = agent === "Nudge";
  const Icon = AGENT_ICONS[agent];
  const iconSize = hub ? 36 : 28;
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className={HANDLE} style={CENTRE} />
      <Handle type="source" position={Position.Top} isConnectable={false} className={HANDLE} style={CENTRE} />
      <button
        type="button"
        onClick={() => onOpen?.(agent)}
        aria-label={`${agent}: ${state}${urgent ? ", found something urgent" : ""}. Show steps`}
        className={cn(
          "nodrag nopan block cursor-pointer rounded-xl border bg-surface text-left transition-[border-color,opacity] duration-300 hover:bg-surface-2/70",
          hub ? (compact ? "w-[190px] px-3 py-3" : "w-[216px] px-3.5 py-3.5") : compact ? "w-[172px] px-3 py-2.5" : "w-[196px] px-3 py-2.5",
          working ? "border-primary/70" : urgent ? "border-nudge/35" : "border-border",
          state === "idle" && "opacity-55"
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border bg-bg",
              working ? "border-primary/60 text-primary-soft" : "border-border text-muted"
            )}
            style={{ width: iconSize, height: iconSize }}
          >
            {Icon ? (
              <Icon className={cn(working && "animate-agent-pulse")} style={{ width: iconSize * 0.5, height: iconSize * 0.5 }} strokeWidth={1.75} />
            ) : (
              <OwlMark size={iconSize * 0.74} urgent={urgent} blinking={working} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-semibold leading-tight text-fg", hub ? "text-sm" : "text-[13px]")}>{agent}</span>
            <span className="block truncate text-[11px] leading-tight text-muted">{job}</span>
          </span>
          <StatusDot state={state} urgent={urgent} />
        </span>
        <span
          className={cn(
            "mt-2 line-clamp-2 min-h-[2lh] text-[12px] leading-snug",
            working ? "text-fg/85" : "text-muted",
            !narration && "opacity-0"
          )}
        >
          {narration || "Idle"}
        </span>
      </button>
    </>
  );
}

function StatusDot({ state, urgent }: { state: AgentNodeType["data"]["state"]; urgent: boolean }) {
  const label = urgent ? "Urgent" : state === "working" ? "Working" : state === "done" ? "Done" : state === "failed" ? "Skipped" : "Idle";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        urgent ? "bg-nudge" : state === "working" ? "bg-primary" : state === "done" ? "bg-muted/70" : state === "failed" ? "bg-danger/70" : "border border-border",
        state === "working" && "animate-agent-pulse",
        urgent && state !== "working" && "opacity-70"
      )}
    />
  );
}

export const AgentNode = memo(AgentNodeView);
