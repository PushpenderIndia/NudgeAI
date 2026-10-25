import type { CalendarEvent, Commit, InboxEmail, MeetingNote, MemoryNote, PullRequest, Ticket, UserProfile } from "@/nudge/types";
import type { Gap, Mismatch, Pick as TaskPick, PlanBlock, StandupDraft } from "@/nudge/briefing";
import { atLocal, localDateISO, minutesBetween, spokenTime, startOfLocalDay } from "./time";

/**
 * Deterministic analysis for the briefing: plain code finds the facts
 * (mismatches, calendar gaps, plan slots, standup lines); models only rank and phrase.
 */

export type Facts = {
  now: Date;
  tz: string;
  profile: UserProfile;
  tickets: Ticket[];
  pullRequests: PullRequest[];
  commits: Commit[];
  events: CalendarEvent[];
  inbox: InboxEmail[];
  notes: MemoryNote[];
  meetings: MeetingNote[];
};

export type Workday = { start: string; end: string };
export const DEFAULT_WORKDAY: Workday = { start: "09:00", end: "18:00" };

const KEY_RE = /[A-Z]+-\d+/g;
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const isUser = (who: string | undefined, profile: UserProfile) =>
  Boolean(who) && who!.toLowerCase().includes(firstName(profile.name).toLowerCase());

export function ticketKeysIn(text: string) {
  return [...new Set(text.toUpperCase().match(KEY_RE) ?? [])];
}

/** An open PR names a ticket (branch or title) that still says To Do → suggest In Review. */
export function findMismatch(f: Pick<Facts, "tickets" | "pullRequests" | "profile">): Omit<Mismatch, "pendingActionId"> | null {
  const byKey = new Map(f.tickets.map((t) => [t.key.toUpperCase(), t]));
  const found: { ticket: Ticket; pr: PullRequest }[] = [];
  for (const pr of [...f.pullRequests].filter((p) => p.state === "open").sort((a, b) => b.openedAt.localeCompare(a.openedAt))) {
    for (const key of ticketKeysIn(`${pr.branch} ${pr.title}`)) {
      const ticket = byKey.get(key);
      if (ticket && ticket.status === "To Do") found.push({ ticket, pr });
    }
  }
  const mine = found.find((m) => isUser(m.pr.author, f.profile) || isUser(m.ticket.assignee, f.profile)) ?? found[0];
  return mine ? { ...mine, suggestedStatus: "In Review" } : null;
}

export function todaysEvents(f: Pick<Facts, "events" | "now" | "tz">) {
  const day = localDateISO(f.now, f.tz);
  return f.events.filter((e) => localDateISO(new Date(e.start), f.tz) === day).sort((a, b) => a.start.localeCompare(b.start));
}

/** Free stretches between today's events inside the workday window. */
export function findGaps(events: CalendarEvent[], now: Date, tz: string, workday: Workday = DEFAULT_WORKDAY, minMinutes = 15): Gap[] {
  const dayStart = atLocal(now, workday.start, tz).getTime();
  const dayEnd = atLocal(now, workday.end, tz).getTime();
  const gaps: Gap[] = [];
  let cursor = dayStart;
  for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    const s = Math.max(new Date(e.start).getTime(), dayStart);
    const end = Math.min(new Date(e.end).getTime(), dayEnd);
    if (s > cursor) gaps.push(gap(cursor, Math.min(s, dayEnd)));
    cursor = Math.max(cursor, end);
  }
  if (cursor < dayEnd) gaps.push(gap(cursor, dayEnd));
  return gaps.filter((g) => g.minutes >= minMinutes);
}

function gap(a: number, b: number): Gap {
  return { start: new Date(a).toISOString(), end: new Date(b).toISOString(), minutes: Math.round((b - a) / 60000) };
}

/** Open work for the user, excluding Done and anything already in review. */
export function backlog(f: Pick<Facts, "tickets" | "profile">, exclude: string[] = []) {
  const mine = f.tickets.filter((t) => isUser(t.assignee, f.profile));
  return (mine.length ? mine : f.tickets).filter((t) => t.status !== "Done" && t.status !== "In Review" && !exclude.includes(t.key));
}

/* ------------------------------ Ranking ------------------------------ */

export type RankContext = { facts: Facts; events: CalendarEvent[]; gaps: Gap[] };

function linkedEmail(t: Ticket, inbox: InboxEmail[]) {
  return inbox.find((e) => e.linkedTicket === t.key) ?? inbox.find((e) => ticketKeysIn(`${e.subject} ${e.body}`).includes(t.key));
}

function blockedPerson(t: Ticket) {
  const m = `${t.notes ?? ""} ${t.title}`.match(/(?:blocking|unblocks?|waiting on|review)\s+([A-Z][a-z]+)/);
  return m?.[1] ?? null;
}

function prFor(t: Ticket, prs: PullRequest[]) {
  const num = t.title.match(/#(\d+)/)?.[1];
  return prs.find((p) => (num && p.number === Number(num)) || ticketKeysIn(`${p.branch} ${p.title}`).includes(t.key)) ?? null;
}

/** The event a gap ends at, e.g. the 14:00 sprint planning. */
function eventAfter(g: Gap, events: CalendarEvent[]) {
  return events.find((e) => new Date(e.start).getTime() >= new Date(g.end).getTime() - 60000) ?? null;
}

export function tagsFor(t: Ticket, ctx: RankContext): TaskPick["tags"] {
  const tags: TaskPick["tags"] = [];
  const today = localDateISO(ctx.facts.now, ctx.facts.tz);
  if (t.due && t.due.slice(0, 10) <= today) tags.push("due_today");
  const email = linkedEmail(t, ctx.facts.inbox);
  if (/escalat/i.test(t.notes ?? "") || email?.urgent) tags.push("escalation");
  if (/\b(blocking|blocked|unblocks?|waiting)\b/i.test(t.notes ?? "") || (/review/i.test(t.title) && blockedPerson(t))) tags.push("unblocks");
  const fitting = ctx.gaps.find((g) => g.minutes >= t.estimateHours * 60);
  if (fitting && eventAfter(fitting, ctx.events)) tags.push("fits_window");
  return tags;
}

function score(t: Ticket, ctx: RankContext) {
  const tags = tagsFor(t, ctx);
  const largest = Math.max(0, ...ctx.gaps.map((g) => g.minutes));
  const fill = largest ? (t.estimateHours * 60) / largest : 0;
  return (
    (tags.includes("due_today") ? 50 : 0) +
    (tags.includes("escalation") ? 25 : 0) +
    (tags.includes("unblocks") ? 35 : 0) +
    (tags.includes("fits_window") ? 10 + (fill >= 0.6 && fill <= 1 ? 15 : 0) : 0) +
    { P1: 30, P2: 15, P3: 0 }[t.priority]
  );
}

/** One line tied to the data: due date + escalation, who it unblocks, which window it fits. */
export function reasonFor(t: Ticket, ctx: RankContext, tags = tagsFor(t, ctx)) {
  const { facts } = ctx;
  const due = tags.includes("due_today") ? "Due today" : `${t.priority}`;
  if (tags.includes("escalation")) {
    const email = linkedEmail(t, facts.inbox);
    return email ? `${due}; ${senderName(email)} escalated it for a customer` : `${due} with a customer escalation`;
  }
  if (tags.includes("unblocks")) {
    const person = blockedPerson(t);
    const pr = prFor(t, facts.pullRequests);
    const days = pr ? Math.max(1, Math.round(minutesBetween(startOfLocalDay(new Date(pr.openedAt), facts.tz), startOfLocalDay(facts.now, facts.tz)) / 1440)) : 0;
    const who = person ?? pr?.author ?? "a teammate";
    return days ? `Unblocks ${who}; review requested ${days} day${days === 1 ? "" : "s"} ago` : `Unblocks ${who}`;
  }
  const fitting = ctx.gaps.find((g) => g.minutes >= t.estimateHours * 60);
  const next = fitting ? eventAfter(fitting, ctx.events) : null;
  if (tags.includes("due_today")) return `Due today, ${t.priority}`;
  if (fitting && next) return `${t.estimateHours} h; fits before your ${spokenTime(next.start, facts.tz)} ${shortEvent(next.title)}`;
  return `${t.priority}, about ${t.estimateHours} h`;
}

export const shortEvent = (title: string) => title.replace(/^(the|a)\s+/i, "").toLowerCase();

/** Deterministic top 3: same story as the model on the seed data. */
export function rankFallback(candidates: Ticket[], ctx: RankContext): TaskPick[] {
  return [...candidates]
    .map((t) => ({ t, s: score(t, ctx) }))
    .sort((a, b) => b.s - a.s || (a.t.due ?? "9").localeCompare(b.t.due ?? "9") || a.t.key.localeCompare(b.t.key))
    .slice(0, 3)
    .map(({ t }) => {
      const tags = tagsFor(t, ctx);
      return { id: t.key, ticket: t, reason: reasonFor(t, ctx, tags), tags };
    });
}

/* ------------------------------ Planning ----------------------------- */

/** Calendar plus the chosen task first, then the other picks, slotted into gaps by estimate. */
export function buildPlan(events: CalendarEvent[], gaps: Gap[], ordered: Ticket[]): PlanBlock[] {
  const blocks: PlanBlock[] = events.map((e) => ({ start: e.start, end: e.end, kind: "event", title: e.title, eventId: e.id }));
  const queue = [...ordered];
  for (const g of gaps) {
    let cursor = new Date(g.start).getTime();
    const end = new Date(g.end).getTime();
    while (queue.length && end - cursor >= 15 * 60000) {
      const t = queue.shift()!;
      const stop = Math.min(end, cursor + Math.max(15, t.estimateHours * 60) * 60000);
      blocks.push({ start: new Date(cursor).toISOString(), end: new Date(stop).toISOString(), kind: "task", title: t.title, ticketKey: t.key });
      cursor = stop;
    }
    if (end - cursor >= 15 * 60000) blocks.push({ start: new Date(cursor).toISOString(), end: g.end, kind: "free", title: "Free" });
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start));
}

export function orderForPick(picks: TaskPick[], choiceId: string) {
  const chosen = picks.find((p) => p.id === choiceId) ?? picks[0];
  return chosen ? [chosen.ticket, ...picks.filter((p) => p !== chosen).map((p) => p.ticket)] : [];
}

/** "Okay, NUD-150 first. You've got until 10:30, then standup, then a clear stretch till 2 pm. ..." */
export function planSentence(plan: PlanBlock[], choiceId: string, tz: string, picks: TaskPick[]) {
  const tasks = plan.filter((b) => b.kind === "task");
  const first = tasks.find((b) => b.ticketKey === choiceId) ?? tasks[0];
  if (!first) return "Your calendar is full today, so I left the picks on your to-do list.";
  const parts = [`Okay, ${first.ticketKey} first.`];
  const nextEvent = plan.find((b) => b.kind === "event" && b.start >= first.end);
  if (nextEvent) {
    const after = plan.find((b) => b.kind === "event" && b.start > nextEvent.end);
    parts.push(
      `You've got until ${spokenTime(nextEvent.start, tz)}, then ${shortEvent(nextEvent.title)}${after ? `, then a clear stretch till ${spokenTime(after.start, tz)}` : ""}.`
    );
    const second = tasks.find((b) => b.start >= nextEvent.end);
    const pick = picks.find((p) => p.id === second?.ticketKey);
    if (second && pick) {
      const who = pick.tags.includes("unblocks") ? pick.reason.match(/Unblocks (\w+)/)?.[1] : null;
      parts.push(`I'll put ${second.ticketKey} after ${shortEvent(nextEvent.title)}${who ? ` so ${who} is unblocked by lunch` : ""}.`);
    }
  } else {
    parts.push(`You've got a clear run until ${spokenTime(first.end, tz)}.`);
  }
  return parts.join(" ");
}

/* ------------------------------ Standup ------------------------------ */

export type StandupFacts = {
  yesterdayCommits: { branch: string; count: number; messages: string[] }[];
  openedPrs: PullRequest[];
  closedTickets: Ticket[];
  meetings: MeetingNote[];
  lastStandup: MemoryNote | null;
};

export function standupFacts(f: Facts): StandupFacts {
  const today = startOfLocalDay(f.now, f.tz).getTime();
  const yesterday = today - 86400000;
  const inYesterday = (iso?: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= yesterday && t < today;
  };
  const branches = new Map<string, string[]>();
  for (const c of f.commits.filter((c) => inYesterday(c.at))) branches.set(c.branch, [...(branches.get(c.branch) ?? []), c.message]);
  const notes = f.notes.filter((n) => n.kind === "standup").sort((a, b) => b.date.localeCompare(a.date));
  return {
    yesterdayCommits: [...branches].map(([branch, messages]) => ({ branch, count: messages.length, messages })),
    openedPrs: f.pullRequests.filter((p) => inYesterday(p.openedAt) && isUser(p.author, f.profile)),
    closedTickets: f.tickets.filter((t) => inYesterday(t.closedAt)),
    meetings: f.meetings
      .filter((m) => new Date(m.heldAt).getTime() >= today - 7 * 86400000 && new Date(m.heldAt).getTime() < today)
      .sort((a, b) => b.heldAt.localeCompare(a.heldAt)),
    lastStandup: notes[0] ?? null,
  };
}

export function buildStandup(
  sf: StandupFacts,
  opts: { plan: PlanBlock[]; picks: TaskPick[]; mismatch: Omit<Mismatch, "pendingActionId"> | null; catchDeclined?: boolean; profile: UserProfile }
): StandupDraft {
  const yesterday: string[] = [];
  for (const c of sf.yesterdayCommits) yesterday.push(`Pushed ${c.count} commit${c.count === 1 ? "" : "s"} on ${c.branch}`);
  for (const pr of sf.openedPrs) {
    const keys = ticketKeysIn(`${pr.branch} ${pr.title}`);
    yesterday.push(`Opened PR #${pr.number} "${pr.title}"${keys.length ? ` for ${keys.join(", ")}` : ""}`);
  }
  for (const t of sf.closedTickets) yesterday.push(`Closed ${t.key} ${t.title}`);
  if (!yesterday.length && sf.lastStandup) yesterday.push(sf.lastStandup.text);
  // The latest meeting's open item for the user, e.g. "Follow-up from the incident review: ...".
  const followUps: string[] = [];
  for (const m of sf.meetings) {
    const open = m.actionItems.find((a) => !a.done && isUser(a.owner, opts.profile));
    if (open) {
      followUps.push(`Follow-up from the ${m.title.split(":")[0].toLowerCase()}: ${open.title.charAt(0).toLowerCase()}${open.title.slice(1)}`);
      break;
    }
  }
  return { yesterday, today: todayLines(opts.plan, opts.picks, opts.mismatch, opts.catchDeclined, followUps), blockers: [] };
}

/** Today's lines: planned tasks in order, any extra lines kept, then the pending ticket move. */
export function todayLines(plan: PlanBlock[], picks: TaskPick[], mismatch: Omit<Mismatch, "pendingActionId"> | null, catchDeclined?: boolean, extra: string[] = []) {
  const lines = plan
    .filter((b) => b.kind === "task" && b.ticketKey)
    .map((b, i) => {
      const t = picks.find((p) => p.id === b.ticketKey)?.ticket;
      return `${i === 0 ? "First: " : ""}${b.ticketKey} ${t?.title ?? b.title}`;
    });
  lines.push(...extra);
  if (mismatch && catchDeclined) lines.push(pendingLine(mismatch));
  return lines;
}

/** Lines of a Today list that aren't planned tasks or the pending move (user edits, follow-ups). */
export function extraTodayLines(today: string[], picks: TaskPick[], mismatch: Pick<Mismatch, "ticket" | "suggestedStatus"> | null) {
  return today.filter((l) => !picks.some((p) => l.replace(/^First: /, "").startsWith(`${p.id} `)) && !(mismatch && l === pendingLine(mismatch)));
}

export const pendingLine = (m: Pick<Mismatch, "ticket" | "suggestedStatus">) => `Pending: move ${m.ticket.key} to ${m.suggestedStatus}`;

/* ------------------------------ Inbox ------------------------------ */

export function triageFallback(inbox: InboxEmail[]) {
  return (
    inbox.find((e) => e.urgent) ??
    inbox.find((e) => /urgent|escalat|asap|failing|down|outage|customer/i.test(`${e.subject} ${e.body}`)) ??
    null
  );
}

export function replyFallback(email: InboxEmail, ticket: Ticket | undefined, profile: UserProfile, firstFreeEnd?: string, tz?: string) {
  const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
  const when = firstFreeEnd && tz ? ` I'll update you by ${spokenTime(firstFreeEnd, tz)}.` : "";
  const what = ticket ? `I'm on it: ${ticket.key} (${ticket.title}) is my first task today.` : "I'm on it and will look into it this morning.";
  return {
    subject,
    body: `Hi ${senderName(email)},\n\nThanks for flagging this. ${what}${when}\n\nBest,\n${firstName(profile.name)}`,
  };
}

/** "Thanks, Maya (Support)" → Maya; otherwise the sender's first name. */
export function senderName(email: InboxEmail) {
  return email.body.match(/(?:thanks|regards|best|cheers),?\s+([A-Z][a-z]+)/i)?.[1] ?? firstName(email.from);
}

/* --------------------------- Standup edits --------------------------- */

const STOP = new Set("the a an that this my me i to about point line item bit part one from of on in for and with please".split(" "));
const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9#\-\s]/g, " ").split(/\s+/).filter((w) => !STOP.has(w)).map((w) => w.replace(/s$/, "")).filter((w) => w.length > 1);

export function standupLines(s: StandupDraft) {
  return [
    "Yesterday:",
    ...s.yesterday,
    "Today:",
    ...s.today,
    "Blockers:",
    ...(s.blockers.length ? s.blockers : ["None"]),
  ];
}

/** Keyword remove/add/change, used when the model is unavailable. */
export function applyEditFallback(s: StandupDraft, instruction: string): StandupDraft {
  const text = instruction.trim();
  const next: StandupDraft = { yesterday: [...s.yesterday], today: [...s.today], blockers: [...s.blockers] };
  const sections = ["yesterday", "today", "blockers"] as const;
  const remove = text.match(/^(?:please\s+)?(?:remove|delete|drop|take out|cut|get rid of)\s+(.+)$/i);
  const change = text.match(/^(?:please\s+)?(?:change|replace|update|edit)\s+(.+?)\s+(?:to|with)\s+(.+)$/i);
  const add = text.match(/^(?:please\s+)?(?:add|also|mention|say|include|put)\s+(?:that\s+)?(.+)$/i);
  const best = (target: string) => {
    const want = words(target);
    let top: { section: (typeof sections)[number]; index: number; score: number } | null = null;
    for (const section of sections)
      next[section].forEach((line, index) => {
        const have = words(line);
        const score = want.filter((w) => have.some((h) => h.includes(w) || w.includes(h))).length;
        if (score > 0 && (!top || score > top.score)) top = { section, index, score };
      });
    return top as { section: (typeof sections)[number]; index: number; score: number } | null;
  };
  if (change) {
    const hit = best(change[1]);
    if (hit) next[hit.section][hit.index] = sentence(change[2]);
    return next;
  }
  if (remove) {
    const hit = best(remove[1]);
    if (hit) next[hit.section].splice(hit.index, 1);
    return next;
  }
  const line = sentence(add ? add[1] : text);
  if (/waiting|blocked|blocker|need|access|stuck/i.test(line)) next.blockers.push(line);
  else next.today.push(line);
  return next;
}

/** "I'm waiting on staging access" → "Waiting on staging access". */
function sentence(raw: string) {
  const s = raw
    .trim()
    .replace(/[.!]+$/, "")
    .replace(/^(?:i'm|i am|im)\s+/i, "")
    .replace(/^i\s+(?:will|'ll)\s+/i, "")
    .replace(/^i\s+/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

