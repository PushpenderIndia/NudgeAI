import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts, meetings, memories } from "@/db/schema";
import { githubLiveConnector } from "@/connectors/live/github";
import { jiraLiveConnector } from "@/connectors/live/jira";
import { getSettings } from "@/lib/settings";
import { LIVE_SESSION } from "@/nudge/session";
import type { Commit, DataSource, MeetingNote, MemoryNote, PullRequest, SlackMessage, Ticket, TicketStatus } from "@/nudge/types";

/**
 * Live mode: real GitHub and Jira through the existing connectors, Slack via an
 * incoming webhook, memory from the local DB. Calendar and email have no live
 * integration yet, so they return empty lists (with a warning) instead of faking data.
 */
const warned = new Set<string>();
function warnOnce(what: string, message: string) {
  if (warned.has(what)) return;
  warned.add(what);
  console.warn(`[nudge:live] ${message}`);
}

const hasGithub = () => Boolean(process.env.GITHUB_TOKEN);
const hasJira = () => Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "Nudge" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json() as Promise<T>;
}

type SearchItem = { number: number; title: string; html_url: string; created_at: string; user: { login: string }; pull_request: { url: string } };
type PullDetail = { head: { ref: string }; state: string; merged_at: string | null; requested_reviewers?: { login: string }[] };

async function listPullRequests(): Promise<PullRequest[]> {
  if (!hasGithub()) {
    warnOnce("github", "GITHUB_TOKEN is not set; GitHub returns no pull requests.");
    return [];
  }
  const me = await gh<{ login: string }>("/user");
  const queries = [`is:pr is:open author:${me.login}`, `is:pr is:open review-requested:${me.login}`];
  const found = new Map<string, SearchItem>();
  for (const q of queries) {
    const res = await gh<{ items: SearchItem[] }>(`/search/issues?per_page=10&q=${encodeURIComponent(q)}`);
    for (const item of res.items) found.set(item.html_url, item);
  }
  return Promise.all(
    [...found.values()].map(async (item) => {
      const pr = await gh<PullDetail>(new URL(item.pull_request.url).pathname);
      return {
        number: item.number,
        title: item.title,
        branch: pr.head.ref,
        state: pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open",
        author: item.user.login,
        openedAt: item.created_at,
        mergedAt: pr.merged_at,
        reviewRequestedFrom: pr.requested_reviewers?.map((r) => r.login) ?? [],
        url: item.html_url,
      } satisfies PullRequest;
    })
  );
}

async function listCommits(opts?: { sinceISO?: string }): Promise<Commit[]> {
  if (!hasGithub()) {
    warnOnce("github", "GITHUB_TOKEN is not set; GitHub returns no commits.");
    return [];
  }
  const since = opts?.sinceISO ? Date.parse(opts.sinceISO) : 0;
  const items = await githubLiveConnector.listItems();
  return items
    .filter((i) => i.type === "commit" && Date.parse(String(i.createdAt)) >= since)
    .map((i) => ({ sha: String(i.ref), message: String(i.title), branch: String(i.repo), at: String(i.createdAt), url: String(i.url) }));
}

function toStatus(name: string): TicketStatus {
  const n = name.toLowerCase();
  if (n.includes("review")) return "In Review";
  if (n.includes("progress")) return "In Progress";
  if (n === "done" || n.includes("closed") || n.includes("resolved")) return "Done";
  return "To Do";
}

async function listTickets(): Promise<Ticket[]> {
  if (!hasJira()) {
    warnOnce("jira", "Jira credentials are not set; Jira returns no tickets.");
    return [];
  }
  const items = await jiraLiveConnector.listItems();
  return items.map((i) => ({
    key: String(i.key),
    title: String(i.summary),
    status: toStatus(String(i.status)),
    priority: "P3",
    estimateHours: 0,
    due: null,
    assignee: String(i.assignee ?? ""),
    url: String(i.url),
  }));
}

// Slack incoming webhooks are post-only, so the channel view is what this process posted.
const posted: SlackMessage[] = [];

async function liveMeetings(): Promise<MeetingNote[]> {
  const rows = await db.select().from(meetings).where(eq(meetings.hasMom, true)).orderBy(desc(meetings.startsAt)).limit(10);
  return Promise.all(
    rows.map(async (m) => {
      const mom = await db
        .select()
        .from(drafts)
        .where(and(eq(drafts.kind, "mom"), eq(drafts.targetId, m.id)))
        .orderBy(desc(drafts.createdAt))
        .get();
      let minutes = "";
      let actionItems: MeetingNote["actionItems"] = [];
      try {
        const parsed = mom ? JSON.parse(mom.content) : null;
        minutes = parsed?.summary ?? "";
        actionItems = (parsed?.actionItems ?? []).map((a: { title: string; owner: string }) => ({ title: a.title, owner: a.owner, done: false }));
      } catch {
        minutes = mom?.content ?? "";
      }
      return { id: m.id, title: m.title, heldAt: m.startsAt.toISOString(), minutes, actionItems };
    })
  );
}

export function liveDataSource(): DataSource {
  return {
    mode: "live",
    sessionKey: LIVE_SESSION,
    github: { listPullRequests, listCommits },
    jira: {
      listTickets,
      async transition(key, to) {
        const result = await jiraLiveConnector.performAction({ type: "transition_ticket", payload: { issueKey: key, toStatus: to } });
        if (!result.ok) throw new Error(result.message);
        const ticket = (await listTickets()).find((t) => t.key === key);
        return ticket ?? { key, title: key, status: to, priority: "P3", estimateHours: 0, due: null, assignee: "", url: "" };
      },
    },
    calendar: {
      async listEvents() {
        warnOnce("calendar", "Google Calendar is not connected; calendar returns no events.");
        return [];
      },
    },
    email: {
      async listInbox() {
        warnOnce("email", "Email is not connected; inbox is empty.");
        return [];
      },
      async listOutbox() {
        return [];
      },
      async send() {
        throw new Error("Live email sending isn't configured yet.");
      },
    },
    slack: {
      async post(channel, text) {
        const url = process.env.SLACK_WEBHOOK_URL;
        if (!url) throw new Error("SLACK_WEBHOOK_URL is not set, so Nudge can't post to Slack.");
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok) throw new Error(`Slack webhook ${res.status}`);
        const settings = await getSettings();
        const msg = { id: randomUUID(), channel, author: settings.userName, text, postedAt: new Date().toISOString() };
        posted.push(msg);
        return msg;
      },
      async listChannel(channel) {
        return posted.filter((m) => m.channel === channel);
      },
    },
    memory: {
      async profile() {
        const settings = await getSettings();
        return { name: settings.userName, role: "Developer", team: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      },
      async notes(): Promise<MemoryNote[]> {
        const rows = await db.select().from(memories).orderBy(desc(memories.updatedAt));
        return rows.map((m) => ({
          id: m.id,
          kind: m.type === "style" ? "preference" : m.type,
          date: (m.updatedAt ?? m.createdAt ?? new Date()).toISOString().slice(0, 10),
          text: m.content,
        }));
      },
      meetings: liveMeetings,
    },
  };
}
