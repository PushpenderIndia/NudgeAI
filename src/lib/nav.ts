import type { LucideIcon } from "lucide-react";
import { Home, Workflow, ShieldCheck, Settings } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  helper: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/today", icon: Home, helper: "Start my day" },
  { label: "Runs", href: "/runs", icon: Workflow, helper: "Agent runs & traces" },
  { label: "Approvals", href: "/approvals", icon: ShieldCheck, helper: "Outward actions" },
  { label: "Settings", href: "/settings", icon: Settings, helper: "Voice & connections" },
];

export const TOOLS = [
  { key: "teams", label: "Teams / Calendar" },
  { key: "email", label: "Email" },
  { key: "github", label: "GitHub" },
  { key: "jira", label: "Jira" },
] as const;

export type ToolKey = (typeof TOOLS)[number]["key"];
