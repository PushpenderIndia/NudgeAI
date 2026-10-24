/**
 * Shared contracts for the "Start my day" briefing. Everything integration-shaped
 * goes through DataSource so demo and live mode share one agent code path.
 */

export const AGENT_NAMES = ["Nudge", "Historian", "Tracker", "Planner", "Scribe", "Courier", "Reporter"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_JOBS: Record<AgentName, string> = {
  Nudge: "Orchestrator",
  Historian: "Past meetings, email, Jira, commits, memory",
  Tracker: "GitHub PRs and Jira tickets",
  Planner: "Ranks tasks and fits the day",
  Scribe: "Meeting minutes and prep",
  Courier: "Email triage and reply drafts",
  Reporter: "Standup and weekly drafts",
};

/* ------------------------------ Domain ------------------------------ */

export type TicketStatus = "To Do" | "In Progress" | "In Review" | "Done";
export type TicketPriority = "P1" | "P2" | "P3";

export type Ticket = {
  key: string; // "NUD-142"
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  estimateHours: number;
  due: string | null; // ISO date
  assignee: string;
  url: string;
  notes?: string; // e.g. "Blocking Priya", "Customer escalation"
  closedAt?: string | null;
};

export type PullRequest = {
  number: number;
  title: string;
  branch: string;
  state: "open" | "merged" | "closed";
  author: string;
  openedAt: string;
  mergedAt?: string | null;
  reviewRequestedFrom?: string[];
  url: string;
};

export type Commit = { sha: string; message: string; branch: string; at: string; url: string };

export type CalendarEvent = { id: string; title: string; start: string; end: string; attendees: string[] };

export type InboxEmail = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  urgent?: boolean;
  linkedTicket?: string | null;
};

export type SlackMessage = { id: string; channel: string; author: string; text: string; postedAt: string };

export type MeetingNote = {
  id: string;
  title: string;
  heldAt: string;
  minutes: string;
  actionItems: { title: string; owner: string; done: boolean }[];
};

export type MemoryNote = { id: string; kind: "standup" | "preference" | "person" | "project"; date: string; text: string };

export type OutboxEmail = { id: string; to: string; subject: string; body: string; sentAt: string };

export type UserProfile = { name: string; role: string; team: string; timezone: string };

/* ---------------------------- DataSource ---------------------------- */

export interface GithubSource {
  listPullRequests(): Promise<PullRequest[]>;
  listCommits(opts?: { sinceISO?: string }): Promise<Commit[]>;
}
export interface JiraSource {
  listTickets(): Promise<Ticket[]>;
  transition(key: string, to: TicketStatus): Promise<Ticket>;
}
export interface CalendarSource {
  listEvents(opts: { fromISO: string; toISO: string }): Promise<CalendarEvent[]>;
}
export interface EmailSource {
  listInbox(): Promise<InboxEmail[]>;
  send(email: Omit<OutboxEmail, "id" | "sentAt">): Promise<OutboxEmail>;
  listOutbox(): Promise<OutboxEmail[]>;
}
export interface SlackSource {
  post(channel: string, text: string): Promise<SlackMessage>;
  listChannel(channel: string): Promise<SlackMessage[]>;
}
export interface MemorySource {
  profile(): Promise<UserProfile>;
  notes(): Promise<MemoryNote[]>;
  meetings(): Promise<MeetingNote[]>;
}

export interface DataSource {
  mode: "demo" | "live";
  /** Demo: cookie-scoped session key. Live: "live". */
  sessionKey: string;
  github: GithubSource;
  jira: JiraSource;
  calendar: CalendarSource;
  email: EmailSource;
  slack: SlackSource;
  memory: MemorySource;
}

/** The whole per-session demo world, stored as JSON in demo_sessions.state. */
export type DemoState = {
  profile: UserProfile;
  tickets: Ticket[];
  pullRequests: PullRequest[];
  commits: Commit[];
  events: CalendarEvent[];
  inbox: InboxEmail[];
  outbox: OutboxEmail[];
  slack: SlackMessage[];
  meetings: MeetingNote[];
  notes: MemoryNote[];
};
