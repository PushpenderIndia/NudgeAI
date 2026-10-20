import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date());

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */
export const meetings = sqliteTable("meetings", {
  id: id(),
  title: text("title").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  attendees: text("attendees", { mode: "json" }).$type<string[]>().notNull().default([]),
  transcript: text("transcript"),
  source: text("source").notNull().default("demo"),
  hasMom: integer("has_mom", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */
export type Triage = "urgent" | "needs_reply" | "fyi";

export const emails = sqliteTable("emails", {
  id: id(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  triage: text("triage").$type<Triage>(),
  triageReason: text("triage_reason"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  isSent: integer("is_sent", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("demo"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Drafts (AI-written content awaiting use/approval)                   */
/* ------------------------------------------------------------------ */
export type DraftKind = "email_reply" | "jira_comment" | "weekly" | "mom";
export type DraftStatus = "draft" | "edited" | "approved" | "rejected";

export const drafts = sqliteTable("drafts", {
  id: id(),
  kind: text("kind").$type<DraftKind>().notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  content: text("content").notNull(),
  tone: text("tone"),
  status: text("status").$type<DraftStatus>().notNull().default("draft"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */
export type TaskPriority = "today" | "this_week" | "urgent";
export type TaskStatus = "todo" | "done";
export type TaskSource = "meeting" | "email" | "jira" | "manual";

export const tasks = sqliteTable("tasks", {
  id: id(),
  title: text("title").notNull(),
  due: integer("due", { mode: "timestamp_ms" }),
  priority: text("priority").$type<TaskPriority>().notNull().default("this_week"),
  status: text("status").$type<TaskStatus>().notNull().default("todo"),
  source: text("source").$type<TaskSource>().notNull().default("manual"),
  sourceId: text("source_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Jira issues                                                         */
/* ------------------------------------------------------------------ */
export const jiraIssues = sqliteTable("jira_issues", {
  id: id(),
  key: text("key").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  assignee: text("assignee"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  url: text("url").notNull(),
  doneToday: integer("done_today", { mode: "boolean" }).notNull().default(false),
});

/* ------------------------------------------------------------------ */
/* Git activity                                                        */
/* ------------------------------------------------------------------ */
export type GitType = "commit" | "pr" | "review";

export const gitActivity = sqliteTable("git_activity", {
  id: id(),
  type: text("type").$type<GitType>().notNull(),
  repo: text("repo").notNull(),
  title: text("title").notNull(),
  ref: text("ref").notNull(),
  url: text("url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Pending actions (the approval gate)                                 */
/* ------------------------------------------------------------------ */
export type ActionType =
  | "send_email"
  | "post_jira_comment"
  | "transition_ticket"
  | "create_timesheet"
  | "create_task";
export type ActionStatus = "pending" | "approved" | "rejected" | "executed";

export const pendingActions = sqliteTable("pending_actions", {
  id: id(),
  actionType: text("action_type").$type<ActionType>().notNull(),
  summary: text("summary").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").$type<ActionStatus>().notNull().default("pending"),
  draftId: text("draft_id"),
  createdAt: createdAt(),
  executedAt: integer("executed_at", { mode: "timestamp_ms" }),
});

/* ------------------------------------------------------------------ */
/* Memories                                                            */
/* ------------------------------------------------------------------ */
export type MemoryType = "person" | "project" | "preference" | "style";

export const memories = sqliteTable("memories", {
  id: id(),
  type: text("type").$type<MemoryType>().notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

/* ------------------------------------------------------------------ */
/* Skills (reusable workflows, toggleable)                             */
/* ------------------------------------------------------------------ */
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(), // slug, e.g. "meeting-to-mom"
  name: text("name").notNull(),
  description: text("description").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Activity log (audit trail of what Nudge did)                        */
/* ------------------------------------------------------------------ */
export const activityLog = sqliteTable("activity_log", {
  id: id(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Settings (singleton row id = "default")                             */
/* ------------------------------------------------------------------ */
export type Permission = "read" | "draft" | "act";
export type Mode = "demo" | "live";

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  mode: text("mode").$type<Mode>().notNull().default("demo"),
  userName: text("user_name").notNull().default("there"),
  toneDefault: text("tone_default").notNull().default("friendly"),
  permissions: text("permissions", { mode: "json" })
    .$type<Record<string, Permission>>()
    .notNull()
    .default({ teams: "draft", email: "act", github: "read", jira: "act" }),
  reminderSchedule: text("reminder_schedule", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull()
    .default({ timesheet: "Fri 17:00", eod: "Daily 17:30", weekly: "Fri 16:00" }),
});

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */
export type ReminderKind = "timesheet" | "eod" | "weekly" | "custom";

export const reminders = sqliteTable("reminders", {
  id: id(),
  kind: text("kind").$type<ReminderKind>().notNull(),
  schedule: text("schedule").notNull(),
  message: text("message").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastFiredAt: integer("last_fired_at", { mode: "timestamp_ms" }),
});

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */
export type Meeting = typeof meetings.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type JiraIssue = typeof jiraIssues.$inferSelect;
export type GitActivity = typeof gitActivity.$inferSelect;
export type PendingAction = typeof pendingActions.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
