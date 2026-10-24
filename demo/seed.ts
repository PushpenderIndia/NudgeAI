import type { Commit, DemoState, MeetingNote, Ticket } from "@/nudge/types";

/**
 * The demo world: one fictional developer, every item planted for a story beat.
 * All dates are relative to `now` (local time) so the story always reads
 * "today" and "yesterday".
 */
export const DEMO_WORKDAY = { start: "09:00", end: "18:00" } as const;
export const DEMO_STANDUP_CHANNEL = "#team-standup";

const REPO = "https://github.com/nudge-co/nudge-api";
const JIRA = "https://nudge-co.atlassian.net/browse";

export function buildSeed(now: Date): DemoState {
  const at = (dayOffset: number, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, m, 0, 0);
    return d.toISOString();
  };
  const dateOnly = (dayOffset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  // Most recent Wednesday strictly before today; the Tuesday design sync is the day before it.
  const wedOffset = -(((now.getDay() - 3 + 7) % 7) || 7);
  const tueOffset = wedOffset - 1;

  const ticket = (t: Omit<Ticket, "url" | "assignee"> & { assignee?: string }): Ticket => ({
    assignee: "Aarav",
    url: `${JIRA}/${t.key}`,
    ...t,
  });

  const tickets: Ticket[] = [
    ticket({ key: "NUD-142", title: "Add retry with backoff to payment webhook", status: "To Do", priority: "P2", estimateHours: 5, due: dateOnly(2), notes: "PR #212 is open for this" }),
    ticket({ key: "NUD-150", title: "Fix 500 on /invoices export", status: "To Do", priority: "P1", estimateHours: 2, due: dateOnly(0), notes: "Customer escalation: Brightline Logistics cannot export invoices (see Support email)" }),
    ticket({ key: "NUD-147", title: "Review Priya's auth refactor PR #209", status: "To Do", priority: "P2", estimateHours: 1, due: dateOnly(0), notes: "Review requested 2 days ago; blocking Priya" }),
    ticket({ key: "NUD-153", title: "Add pagination to /orders", status: "To Do", priority: "P2", estimateHours: 3, due: dateOnly(3), notes: "Fits a morning block" }),
    ticket({ key: "NUD-156", title: "Upgrade pg driver to 8.13", status: "To Do", priority: "P3", estimateHours: 2, due: null }),
    ticket({ key: "NUD-158", title: "Document webhook signature verification", status: "To Do", priority: "P3", estimateHours: 1.5, due: null }),
    ticket({ key: "NUD-160", title: "Remove deprecated /v1/customers endpoint", status: "To Do", priority: "P3", estimateHours: 4, due: dateOnly(9) }),
    ticket({ key: "NUD-161", title: "Add request-id to structured logs", status: "In Progress", priority: "P3", estimateHours: 2, due: null }),
    ticket({ key: "NUD-131", title: "Rate limit /auth/token", status: "Done", priority: "P2", estimateHours: 3, due: null, closedAt: at(-4, "16:20") }),
    ticket({ key: "NUD-135", title: "Fix flaky orders integration test", status: "Done", priority: "P3", estimateHours: 1, due: null, closedAt: at(-3, "11:05") }),
    ticket({ key: "NUD-138", title: "Return 409 on duplicate invoice number", status: "Done", priority: "P2", estimateHours: 2, due: null, closedAt: at(-2, "15:40") }),
    ticket({ key: "NUD-140", title: "Add idempotency key to payment intents", status: "Done", priority: "P2", estimateHours: 4, due: null, closedAt: at(-1, "12:10") }),
  ];

  const commit = (sha: string, message: string, branch: string, dayOffset: number, hhmm: string): Commit => ({
    sha,
    message,
    branch,
    at: at(dayOffset, hhmm),
    url: `${REPO}/commit/${sha}`,
  });
  const commits: Commit[] = [
    commit("a41f9c2", "Add exponential backoff to webhook dispatcher", "feat/webhook-retry", -1, "10:12"),
    commit("b7d03e8", "Persist webhook attempts for retry bookkeeping", "feat/webhook-retry", -1, "13:47"),
    commit("c92e1a4", "Cover retry exhaustion with tests", "feat/webhook-retry", -1, "16:58"),
    commit("d18b6f0", "Idempotency key middleware for payment intents", "feat/idempotency-keys", -2, "11:30"),
    commit("e5c4a17", "Return 409 on duplicate invoice number", "fix/invoice-duplicates", -2, "15:22"),
    commit("f60a2d9", "Stabilise orders integration test fixtures", "fix/flaky-orders-test", -3, "10:44"),
    commit("0a7e3b5", "Token bucket limiter for /auth/token", "feat/auth-rate-limit", -4, "14:05"),
    commit("1b9f4c6", "Rate limit config via env", "feat/auth-rate-limit", -4, "16:02"),
    commit("2c3d5e7", "Bump zod and fix schema types", "chore/deps", -5, "09:50"),
  ];

  const meeting = (id: string, title: string, dayOffset: number, hhmm: string, minutes: string, item: string, owner: string): MeetingNote => ({
    id,
    title,
    heldAt: at(dayOffset, hhmm),
    minutes,
    actionItems: [{ title: item, owner, done: false }],
  });

  return {
    profile: { name: "Aarav", role: "Backend developer", team: "nudge-api", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    tickets,
    pullRequests: [
      { number: 212, title: "Add retry to payment webhook (NUD-142)", branch: "feat/webhook-retry-NUD-142", state: "open", author: "Aarav", openedAt: at(-1, "17:20"), url: `${REPO}/pull/212` },
      { number: 209, title: "Refactor auth middleware into token service", branch: "refactor/auth-service", state: "open", author: "Priya", openedAt: at(-2, "15:10"), reviewRequestedFrom: ["Aarav"], url: `${REPO}/pull/209` },
      { number: 205, title: "Idempotency key for payment intents (NUD-140)", branch: "feat/idempotency-keys", state: "merged", author: "Aarav", openedAt: at(-3, "10:00"), mergedAt: at(-1, "12:05"), url: `${REPO}/pull/205` },
      { number: 201, title: "Rate limit /auth/token (NUD-131)", branch: "feat/auth-rate-limit", state: "merged", author: "Aarav", openedAt: at(-5, "11:00"), mergedAt: at(-4, "16:15"), url: `${REPO}/pull/201` },
    ],
    commits,
    events: [
      { id: "evt-standup", title: "Standup", start: at(0, "10:30"), end: at(0, "10:45"), attendees: ["Aarav", "Priya", "Marco", "Lena"] },
      { id: "evt-planning", title: "Sprint planning", start: at(0, "14:00"), end: at(0, "16:00"), attendees: ["Aarav", "Priya", "Marco", "Lena", "Sofia"] },
      { id: "evt-1on1", title: "1:1 with Sofia", start: at(0, "17:00"), end: at(0, "17:30"), attendees: ["Aarav", "Sofia"] },
    ],
    inbox: [
      {
        id: "mail-support",
        from: "Support",
        fromEmail: "support@nudge-co.com",
        subject: "Urgent: Brightline Logistics can't export invoices",
        body: "Hi Aarav, Brightline Logistics has been getting a 500 error on the /invoices export since this morning. They need the export for month-end close today. Can you take a look and let us know an ETA we can share? Thanks, Maya (Support)",
        receivedAt: at(0, "08:12"),
        urgent: true,
        linkedTicket: "NUD-150",
      },
      {
        id: "mail-priya",
        from: "Priya",
        fromEmail: "priya@nudge-co.com",
        subject: "Re: auth refactor PR #209",
        body: "Hey, when you get a chance could you look at #209? I'd like to merge before planning so I can start on the session work.",
        receivedAt: at(-1, "18:05"),
        linkedTicket: "NUD-147",
      },
      {
        id: "mail-eng",
        from: "Engineering Updates",
        fromEmail: "eng-updates@nudge-co.com",
        subject: "Staging maintenance window on Thursday",
        body: "Staging will be read-only on Thursday from 07:00 to 08:00 for a database upgrade. No action needed.",
        receivedAt: at(-1, "09:30"),
      },
    ],
    outbox: [],
    slack: [
      { id: "slack-1", channel: DEMO_STANDUP_CHANNEL, author: "Priya", text: "Yesterday: finished the auth refactor and opened PR #209. Today: session store spike. Blockers: waiting on a review for #209.", postedAt: at(0, "08:40") },
      { id: "slack-2", channel: DEMO_STANDUP_CHANNEL, author: "Marco", text: "Yesterday: dashboards for webhook failures. Today: alert routing. No blockers.", postedAt: at(0, "08:55") },
    ],
    meetings: [
      meeting(
        "mtg-design-sync",
        "Design sync: webhook retries",
        tueOffset,
        "11:00",
        "Agreed on exponential backoff with a cap of 6 attempts for payment webhooks. Failed attempts are stored for replay. Marco will add a dashboard for webhook failures.",
        "Write the retry policy into the webhook README",
        "Aarav"
      ),
      meeting(
        "mtg-incident-review",
        "Incident review: invoices export timeout",
        wedOffset,
        "15:00",
        "Last week's /invoices export timeout was traced to an unbounded query on large accounts. Short-term fix shipped; streaming the export is the long-term fix.",
        "Add a query limit and streaming to the invoices export",
        "Aarav"
      ),
    ],
    notes: [
      { id: "note-standup", kind: "standup", date: dateOnly(-1), text: "finish webhook retries, start invoices bug" },
      { id: "note-pref", kind: "preference", date: dateOnly(-7), text: "Prefers deep work in the morning, reviews after standup" },
      { id: "note-priya", kind: "person", date: dateOnly(-7), text: "Priya: teammate on nudge-api, owns auth" },
      { id: "note-project", kind: "project", date: dateOnly(-7), text: "nudge-api: payments, invoices and orders services" },
    ],
  };
}
