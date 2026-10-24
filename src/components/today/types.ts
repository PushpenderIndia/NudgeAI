import type { AgentTraceRun } from "@/components/agents/AgentTrace";
import type { RunView } from "@/lib/agent-runs";

export type InsightView = { id: string; text: string; sourceType: string | null; sourceLabel: string | null; href: string | null };

export type ApprovalView = {
  id: string;
  actionType: import("@/db/schema").ActionType;
  title: string;
  reason: string;
  subject: string | null;
  preview: string;
  createdAt: string | null;
  trace: AgentTraceRun | null;
};

export type TaskView = { id: string; title: string; due: string | null; urgent: boolean; source: string; agent: string };

export type MeetingView = { id: string; title: string; time: string; past: boolean; status: string | null };

export type TodayData = {
  userName: string;
  dateLabel: string;
  demoMode: boolean;
  planRun: RunView | null;
  sideRun: RunView | null;
  insights: InsightView[];
  approvals: ApprovalView[];
  tasks: TaskView[];
  meetings: MeetingView[];
};
