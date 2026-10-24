import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts, tasks } from "@/db/schema";
import type { Email, FoundItem, GitActivity, JiraIssue, Meeting } from "@/db/schema";
import { getConnector } from "@/connectors";
import { MomSchema, type Mom } from "@/skills/meeting-to-mom";
import { formatTime } from "@/lib/utils";
import type { Candidate } from "./narrate";

/**
 * Shared data access for the agents. Everything goes through the connectors, so
 * live mode reads real tools and a failing tool surfaces as an error string the
 * agent can narrate honestly instead of crashing the run.
 */

export type Fetched<T> = { rows: T[]; error?: string };

async function fetchVia<T>(key: "teams" | "email" | "github" | "jira"): Promise<Fetched<T>> {
  try {
    const connector = await getConnector(key);
    return { rows: (await connector.listItems()) as unknown as T[] };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : `Couldn't reach ${key}.` };
  }
}

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

export async function fetchMeetings(): Promise<Fetched<Meeting>> {
  const res = await fetchVia<Meeting>("teams");
  return { ...res, rows: res.rows.map((m) => ({ ...m, startsAt: toDate(m.startsAt), endsAt: toDate(m.endsAt) })) };
}
export async function fetchEmails(): Promise<Fetched<Email>> {
  const res = await fetchVia<Email>("email");
  return { ...res, rows: res.rows.map((e) => ({ ...e, receivedAt: toDate(e.receivedAt) })) };
}
export async function fetchGit(): Promise<Fetched<GitActivity>> {
  const res = await fetchVia<GitActivity>("github");
  return { ...res, rows: res.rows.map((g) => ({ ...g, createdAt: toDate(g.createdAt) })) };
}
export async function fetchJira(): Promise<Fetched<JiraIssue>> {
  return fetchVia<JiraIssue>("jira");
}

/** Latest minutes per meeting id, from Scribe's stored drafts. */
export async function fetchMoms(): Promise<Map<string, Mom>> {
  const rows = await db.select().from(drafts).where(eq(drafts.kind, "mom")).orderBy(desc(drafts.createdAt));
  const map = new Map<string, Mom>();
  for (const row of rows) {
    if (!row.targetId || map.has(row.targetId)) continue;
    try {
      const parsed = MomSchema.safeParse(JSON.parse(row.content));
      if (parsed.success) map.set(row.targetId, parsed.data);
    } catch {
      // Malformed draft content; skip it.
    }
  }
  return map;
}

export async function doneTaskTitles() {
  const rows = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.status, "done"));
  return rows.map((r) => r.title.toLowerCase());
}

export function dayBounds(now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

/** "yesterday" when the last meeting day was yesterday, otherwise "on Friday". */
export function relativeDayLabel(date: Date, now = new Date()) {
  const { dayStart } = dayBounds(now);
  const yesterday = new Date(dayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= yesterday && date < dayStart) return "yesterday";
  return `on ${date.toLocaleDateString("en-AU", { weekday: "long" })}`;
}

export const meetingItem = (m: Meeting): FoundItem => ({
  kind: "meeting",
  label: m.title,
  detail: `${m.startsAt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · ${formatTime(m.startsAt)}`,
  href: "/meetings",
});
export const emailItem = (e: Email, urgent = false): FoundItem => ({
  kind: "email",
  label: e.subject,
  detail: e.fromName,
  urgent,
});
export const jiraItem = (j: JiraIssue): FoundItem => ({ kind: "jira", label: `${j.key} · ${j.summary}`, detail: j.status, href: "/dev" });
export const gitItem = (g: GitActivity): FoundItem => ({
  kind: g.type === "pr" ? "pr" : "commit",
  label: g.title,
  detail: `${g.repo}${g.type === "commit" ? ` · ${g.ref.slice(0, 7)}` : ""}`,
  href: "/dev",
});

/** Run-wide registry of everything agents have seen, so later steps can cite earlier finds. */
export class CandidateBook {
  private items = new Map<string, Candidate>();
  add(ref: string, item: FoundItem) {
    this.items.set(ref, { ref, item });
    return ref;
  }
  get(ref: string) {
    return this.items.get(ref)?.item;
  }
  pick(prefixes: string[]) {
    return [...this.items.values()].filter((c) => prefixes.some((p) => c.ref.startsWith(p)));
  }
  all() {
    return [...this.items.values()];
  }
}

/** Shared words between two strings (ignoring short/common words), for cheap linking. */
export function overlap(a: string, b: string) {
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !COMMON.has(w)));
  const wb = words(b);
  return [...words(a)].filter((w) => wb.has(w));
}
const COMMON = new Set(["with", "from", "that", "this", "have", "will", "your", "about", "need", "next", "before", "after", "project", "team", "today"]);
