import type { CalendarEvent, Ticket, PullRequest, InboxEmail } from "./types";

/**
 * Structured result of the plan_day agent run, saved on agent_runs.briefing.
 * Deterministic code fills the facts; the model ranks, explains and phrases.
 * The scene engine and the settled Today page both render from this.
 */
export type Mismatch = {
  ticket: Ticket;
  pr: PullRequest;
  suggestedStatus: Ticket["status"]; // "In Review"
  pendingActionId: string; // transition_ticket approval
};

export type Pick = {
  id: string; // ticket key, e.g. "NUD-150"
  ticket: Ticket;
  reason: string; // one line tied to real data
  tags: ("due_today" | "escalation" | "unblocks" | "fits_window")[];
};

export type Gap = { start: string; end: string; minutes: number };

export type PlanBlock = {
  start: string;
  end: string;
  kind: "event" | "task" | "free";
  title: string;
  ticketKey?: string;
  eventId?: string;
};

export type StandupDraft = {
  yesterday: string[];
  today: string[];
  blockers: string[];
};

export type InboxDraft = {
  email: InboxEmail;
  reply: { subject: string; body: string };
  pendingActionId: string; // send_email approval
};

export type Briefing = {
  userName: string;
  dateISO: string;
  mismatch: Mismatch | null;
  picks: Pick[]; // exactly 3 when there is enough data
  events: CalendarEvent[]; // today's calendar
  gaps: Gap[];
  /** Plan for the default (first) pick; recomputed for the chosen pick by /answer. */
  plan: PlanBlock[];
  standup: StandupDraft;
  /** pending post_slack approval for the current standup text. */
  standupActionId: string | null;
  inbox: InboxDraft | null;
  /** Remaining tickets for the To-do rail (excludes the pinned pick once chosen). */
  todo: Ticket[];
};

export const STANDUP_CHANNEL = "#team-standup";

export function standupToText(s: StandupDraft) {
  const block = (title: string, lines: string[]) => `*${title}*\n${(lines.length ? lines : ["Nothing"]).map((l) => `• ${l}`).join("\n")}`;
  return [block("Yesterday", s.yesterday), block("Today", s.today), block("Blockers", s.blockers)].join("\n\n");
}
