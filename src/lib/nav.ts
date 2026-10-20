import type { LucideIcon } from "lucide-react";
import {
  Home,
  CalendarClock,
  ListChecks,
  GitBranch,
  FileText,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  helper: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/today", icon: Home, helper: "Your day at a glance" },
  { label: "Meetings", href: "/meetings", icon: CalendarClock, helper: "Minutes & action items" },
  { label: "Tasks", href: "/tasks", icon: ListChecks, helper: "Everything to do" },
  { label: "Dev Activity", href: "/dev", icon: GitBranch, helper: "GitHub & Jira" },
  { label: "Weekly Update", href: "/weekly", icon: FileText, helper: "Friday report, one click" },
  { label: "Settings", href: "/settings", icon: Settings, helper: "Connections & privacy" },
];

export const TOOLS = [
  { key: "teams", label: "Teams / Calendar" },
  { key: "email", label: "Email" },
  { key: "github", label: "GitHub" },
  { key: "jira", label: "Jira" },
] as const;

export type ToolKey = (typeof TOOLS)[number]["key"];
