import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import type { FoundItem } from "@/db/schema";
import { createRun, describePayload, finishRun, stepper } from "@/ai/agents/runs";
import type { Briefing, InboxDraft, Mismatch, Pick as TaskPick, StandupDraft } from "@/nudge/briefing";
import { STANDUP_CHANNEL, standupToText } from "@/nudge/briefing";
import type { RequestContext } from "@/nudge/session";
import type { CalendarEvent, Commit, DataSource, InboxEmail, MeetingNote, MemoryNote, PullRequest, Ticket, UserProfile } from "@/nudge/types";
import { getDataSource } from "@/nudge/datasource";
import {
  DEFAULT_WORKDAY,
  backlog,
  buildPlan,
  buildStandup,
  findGaps,
  findMismatch,
  firstName,
  rankFallback,
  reasonFor,
  replyFallback,
  standupFacts,
  tagsFor,
  todaysEvents,
  triageFallback,
  type Facts,
  type RankContext,
  type Workday,
} from "./analysis";
import { queueSessionAction } from "./actions";
import { modelJSON, VOICE_RULES } from "./model";
import { buildTemplateScript, generateSceneScript } from "./script";
import { clockTime, safeZone, spokenTime, startOfLocalDay } from "./time";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const jiraItem = (t: Ticket, detail?: string, urgent?: boolean): FoundItem => ({ kind: "jira", label: `${t.key} ${t.title}`, detail: detail ?? t.status, href: t.url, urgent });
const prItem = (p: PullRequest, detail?: string): FoundItem => ({ kind: "pr", label: `PR #${p.number} ${p.title}`, detail: detail ?? p.branch, href: p.url });
const commitItem = (c: Commit): FoundItem => ({ kind: "commit", label: c.message, detail: c.branch, href: c.url });
const emailItem = (e: InboxEmail, urgent?: boolean): FoundItem => ({ kind: "email", label: e.subject, detail: e.from, urgent });
const meetingItem = (m: MeetingNote): FoundItem => ({ kind: "meeting", label: m.title, detail: `${m.actionItems.filter((a) => !a.done).length} open items` });
const eventItem = (e: CalendarEvent, tz: string): FoundItem => ({ kind: "meeting", label: e.title, detail: `${clockTime(e.start, tz)}–${clockTime(e.end, tz)}` });

/** Workday window: the demo seed may export DEMO_WORKDAY; otherwise 09:00–18:00. */
export async function workdayFor(ds: DataSource): Promise<Workday> {
  void ds;
  return DEFAULT_WORKDAY;
}

const RankSchema = z.object({ picks: z.array(z.object({ key: z.string(), reason: z.string().min(3) })).min(1).max(3) });
const StandupSchema = z.object({ yesterday: z.array(z.string()), today: z.array(z.string()), blockers: z.array(z.string()).default([]) });
const TriageSchema = z.object({ urgentId: z.string().nullable(), reason: z.string().default("") });
const ReplySchema = z.object({ subject: z.string().min(1), body: z.string().min(10) });

/**
 * plan_day for "Start my day": Nudge → Historian → Tracker → Planner → Reporter → Courier → Nudge.
 * Every agent works against the DataSource (demo or live, same code), narrates one line from the
 * data it actually fetched, and hands a payload on. Outward actions are only queued for approval.
 */
export async function runBriefing(runId: string, ds: DataSource) {
  const step = stepper(runId);
  const now = new Date();
  const sessionKey = ds.sessionKey;
  const workday = await workdayFor(ds);

  /* ---------------- Nudge: kick off ---------------- */
  const profile = await step<UserProfile>(
    { agent: "Nudge", phase: "Delegating", tool: "Orchestrator", tier: "fast", input: "Today's calendar, tickets, PRs, inbox and memory" },
    async () => {
      const p = await ds.memory.profile();
      return {
        narration: `Planning ${firstName(p.name)}'s day on ${p.team}: Historian first for yesterday's context.`,
        foundItems: [],
        modelUsed: false,
        handoffTo: "Historian",
        handoffSummary: "asking for yesterday's standup, commits and meetings",
        result: p,
      };
    },
    { narration: "I couldn't load your profile, so I'll keep going with what I can reach.", result: { name: "there", role: "", team: "your team", timezone: "" }, handoffTo: "Historian" }
  );
  const tz = safeZone(profile.timezone);

  /* ---------------- Historian: memory, meetings, commits ---------------- */
  const history = await step(
    { agent: "Historian", phase: "Fetching context", tool: "Memory, Meetings, GitHub", tier: "fast", input: "Yesterday's standup note, recent minutes and commits" },
    async () => {
      const since = new Date(startOfLocalDay(now, tz).getTime() - 7 * 86400000).toISOString();
      const [notes, meetings, commits] = await Promise.all([ds.memory.notes(), ds.memory.meetings(), ds.github.listCommits({ sinceISO: since })]);
      const partial: Facts = { now, tz, profile, tickets: [], pullRequests: [], commits, events: [], inbox: [], notes, meetings };
      const sf = standupFacts(partial);
      const withMinutes = meetings.filter((m) => m.minutes && m.actionItems.some((a) => !a.done));
      const yCommits = sf.yesterdayCommits.reduce((n, c) => n + c.count, 0);
      const said = sf.lastStandup ? `Yesterday's standup said "${sf.lastStandup.text}"` : "No standup note from yesterday";
      return {
        narration: `${said}; ${plural(yCommits, "commit")} since, and ${plural(withMinutes.length, "meeting")} with open action items.`,
        foundItems: [
          ...(sf.lastStandup ? [{ kind: "memory", label: sf.lastStandup.text, detail: "Yesterday's standup" } as FoundItem] : []),
          ...withMinutes.slice(0, 2).map(meetingItem),
          ...commits.filter((c) => sf.yesterdayCommits.some((y) => y.branch === c.branch)).slice(0, 3).map(commitItem),
        ],
        modelUsed: false,
        handoffTo: "Tracker",
        handoffSummary: describePayload([[yCommits, "commit", "commits"], [withMinutes.length, "meeting", "meetings"]]),
        result: { notes, meetings, commits },
      };
    },
    { narration: "I couldn't reach memory or meeting notes, so the standup will lean on GitHub.", result: { notes: [] as MemoryNote[], meetings: [] as MeetingNote[], commits: [] as Commit[] }, handoffTo: "Tracker" }
  );

  /* ---------------- Tracker: PRs, tickets, mismatch ---------------- */
  const tracked = await step(
    { agent: "Tracker", phase: "Checking PRs and tickets", tool: "GitHub, Jira", tier: "fast", input: "Open PRs, branches and ticket statuses" },
    async () => {
      const [pullRequests, tickets] = await Promise.all([ds.github.listPullRequests(), ds.jira.listTickets()]);
      const found = findMismatch({ tickets, pullRequests, profile });
      let mismatch: Mismatch | null = null;
      if (found) {
        const action = await queueSessionAction({
          actionType: "transition_ticket",
          summary: `Move ${found.ticket.key} to ${found.suggestedStatus}`,
          payload: { key: found.ticket.key, from: found.ticket.status, to: found.suggestedStatus, pr: found.pr.number },
          reason: `PR #${found.pr.number} is open for ${found.ticket.key}, but the ticket still says ${found.ticket.status}.`,
          runId,
          sessionKey,
        });
        mismatch = { ...found, pendingActionId: action.id };
      }
      const branchCommits = found ? history.commits.filter((c) => c.branch === found.pr.branch) : [];
      const open = pullRequests.filter((p) => p.state === "open");
      const narration = found
        ? `${branchCommits.length ? `${plural(branchCommits.length, "commit")} on ${found.pr.branch}, ` : ""}PR #${found.pr.number} open, but ${found.ticket.key} still says ${found.ticket.status}.`
        : `${plural(open.length, "open PR")} and ${plural(tickets.filter((t) => t.status !== "Done").length, "open ticket")}; statuses all match.`;
      return {
        narration,
        foundItems: found
          ? [prItem(found.pr), jiraItem(found.ticket, `${found.ticket.status} → ${found.suggestedStatus}`, true)]
          : open.slice(0, 3).map((p) => prItem(p)),
        modelUsed: false,
        handoffTo: "Planner",
        handoffSummary: describePayload([[tickets.filter((t) => t.status !== "Done").length, "open ticket", "open tickets"], [found ? 1 : 0, "mismatch", "mismatches"]]),
        result: { pullRequests, tickets, mismatch },
      };
    },
    { narration: "GitHub or Jira didn't answer, so I can't check ticket statuses right now.", result: { pullRequests: [] as PullRequest[], tickets: [] as Ticket[], mismatch: null as Mismatch | null }, handoffTo: "Planner" }
  );

  const inbox = await ds.email.listInbox().catch(() => [] as InboxEmail[]);
  const facts: Facts = { now, tz, profile, ...history, ...tracked, events: [], inbox };

  /* ---------------- Planner: calendar gaps, top 3, plan ---------------- */
  const planned = await step(
    { agent: "Planner", phase: "Ranking your tasks", tool: "Calendar, Jira", tier: "heavy", input: "Today's calendar and the open backlog" },
    async () => {
      const dayFrom = startOfLocalDay(now, tz);
      const events = todaysEvents({
        now,
        tz,
        events: await ds.calendar.listEvents({ fromISO: dayFrom.toISOString(), toISO: new Date(dayFrom.getTime() + 86400000).toISOString() }),
      });
      facts.events = events;
      const gaps = findGaps(events, now, tz, workday);
      const ctx: RankContext = { facts, events, gaps };
      const candidates = backlog(facts, tracked.mismatch ? [tracked.mismatch.ticket.key] : []);
      const fallback = () => rankFallback(candidates, ctx);
      const ranked = await modelJSON(
        {
          tier: "heavy",
          system: `You are Planner inside Nudge. Pick the developer's top 3 tasks for today and give each a one-line reason tied to the data (due date, customer escalation, who it unblocks, which calendar gap it fits before).\n${VOICE_RULES}\nReturn {"picks":[{"key":"NUD-1","reason":"..."}]} with exactly 3 keys from the candidates, best first. Reasons under 12 words.`,
          user: JSON.stringify({
            today: clockTime(now, tz),
            calendar: events.map((e) => ({ title: e.title, start: spokenTime(e.start, tz), end: spokenTime(e.end, tz) })),
            freeGaps: gaps.map((g) => ({ start: spokenTime(g.start, tz), end: spokenTime(g.end, tz), minutes: g.minutes })),
            candidates: candidates.map((t) => ({ key: t.key, title: t.title, priority: t.priority, due: t.due, estimateHours: t.estimateHours, notes: t.notes, signals: tagsFor(t, ctx) })),
            urgentEmails: inbox.filter((e) => e.urgent).map((e) => ({ from: e.from, subject: e.subject, linkedTicket: e.linkedTicket })),
          }),
          schema: RankSchema,
        },
        () => ({ picks: fallback().map((p) => ({ key: p.id, reason: p.reason })) })
      );
      const byKey = new Map(candidates.map((t) => [t.key, t]));
      let picks: TaskPick[] = [...new Set(ranked.value.picks.map((p) => p.key))]
        .filter((k) => byKey.has(k))
        .map((key) => {
          const t = byKey.get(key)!;
          return { id: key, ticket: t, reason: ranked.value.picks.find((p) => p.key === key)!.reason || reasonFor(t, ctx), tags: tagsFor(t, ctx) };
        });
      if (picks.length < Math.min(3, candidates.length)) picks = fallback();
      const plan = buildPlan(events, gaps, picks.map((p) => p.ticket));
      const big = [...gaps].sort((a, b) => b.minutes - a.minutes)[0];
      const until = big ? events.find((e) => e.start >= big.end) : null;
      return {
        narration: `Top 3: ${picks.map((p) => p.id).join(", ")}.${big ? ` ${Math.floor(big.minutes / 60)} h ${big.minutes % 60 ? `${big.minutes % 60} min ` : ""}free from ${spokenTime(big.start, tz)}${until ? ` until the ${spokenTime(until.start, tz)} ${until.title.toLowerCase()}` : ""}.` : " No free time today."}`,
        foundItems: [...picks.map((p) => jiraItem(p.ticket, p.reason, p.tags.includes("escalation"))), ...events.slice(0, 3).map((e) => eventItem(e, tz))],
        modelUsed: ranked.modelUsed,
        handoffTo: "Reporter",
        handoffSummary: describePayload([[picks.length, "pick", "picks"], [plan.filter((b) => b.kind === "task").length, "planned block", "planned blocks"]]),
        result: { events, gaps, picks, plan, candidates },
      };
    },
    { narration: "I couldn't read your calendar, so the plan is a plain priority list.", result: { events: [] as CalendarEvent[], gaps: [], picks: [] as TaskPick[], plan: [], candidates: [] as Ticket[] }, handoffTo: "Reporter" }
  );

  /* ---------------- Reporter: standup draft ---------------- */
  const reported = await step(
    { agent: "Reporter", phase: "Drafting your standup", tool: "Slack", tier: "heavy", input: "Yesterday's commits, ticket changes, today's picks and plan" },
    async () => {
      const sf = standupFacts(facts);
      const base = buildStandup(sf, { plan: planned.plan, picks: planned.picks, mismatch: tracked.mismatch, profile });
      const drafted = await modelJSON<StandupDraft>(
        {
          tier: "heavy",
          system: `You are Reporter inside Nudge. Write the developer's standup as short bullet lines (under 12 words each) in three lists: yesterday, today, blockers.\n${VOICE_RULES}\nKeep every ticket key and PR number from the draft facts. Today must follow the plan order. Blockers is [] unless the data shows one.`,
          user: JSON.stringify({ draft: base, yesterdayStandupNote: sf.lastStandup?.text ?? null, commits: sf.yesterdayCommits, meetings: sf.meetings.map((m) => ({ title: m.title, openItems: m.actionItems.filter((a) => !a.done) })) }),
          schema: StandupSchema,
        },
        () => base
      );
      const standup = drafted.value.today.length || !base.today.length ? drafted.value : base;
      const action = await queueSessionAction({
        actionType: "post_slack",
        summary: `Post standup to ${STANDUP_CHANNEL}`,
        payload: { channel: STANDUP_CHANNEL, text: standupToText(standup) },
        reason: "Your daily standup draft",
        runId,
        sessionKey,
      });
      return {
        narration: `Standup drafted for ${STANDUP_CHANNEL}: ${plural(standup.yesterday.length, "line")} for yesterday, ${standup.today.length} for today, ${standup.blockers.length ? plural(standup.blockers.length, "blocker") : "no blockers"}.`,
        foundItems: [{ kind: "draft", label: `Standup for ${STANDUP_CHANNEL}`, detail: standup.today[0] ?? "" } as FoundItem],
        modelUsed: drafted.modelUsed,
        handoffTo: "Courier",
        handoffSummary: "standup waiting for your OK; checking the inbox next",
        result: { standup, standupActionId: action.id as string | null },
      };
    },
    { narration: "I couldn't draft the standup this time; you can write it on the page.", result: { standup: { yesterday: [], today: [], blockers: [] } as StandupDraft, standupActionId: null }, handoffTo: "Courier" }
  );

  /* ---------------- Courier: triage (fast) then reply draft (heavy) ---------------- */
  const urgent = await step(
    { agent: "Courier", phase: "Triaging your inbox", tool: "Email", tier: "fast", input: `${plural(inbox.length, "email")} in the inbox` },
    async () => {
      const triaged = await modelJSON(
        {
          tier: "fast",
          system: 'You are Courier inside Nudge. From the inbox, pick the single email that needs a reply from the developer today because it is urgent (customer impact, escalation, outage). Return {"urgentId": id or null, "reason": "..."}.',
          user: JSON.stringify(inbox.map((e) => ({ id: e.id, from: e.from, subject: e.subject, body: e.body.slice(0, 400), flaggedUrgent: Boolean(e.urgent) }))),
          schema: TriageSchema,
        },
        () => ({ urgentId: triageFallback(inbox)?.id ?? null, reason: "" })
      );
      const email = inbox.find((e) => e.id === triaged.value.urgentId) ?? (triaged.modelUsed ? null : triageFallback(inbox));
      return {
        narration: email
          ? `${plural(inbox.length, "email")}, 1 urgent: ${firstName(email.from)} wrote "${email.subject}".`
          : `${plural(inbox.length, "email")}, nothing urgent.`,
        foundItems: inbox.slice(0, 3).map((e) => emailItem(e, e.id === email?.id)),
        modelUsed: triaged.modelUsed,
        handoffTo: "Courier",
        handoffSummary: email ? "drafting a reply to the urgent one" : "no reply needed",
        result: email,
      };
    },
    { narration: "I couldn't read the inbox just now.", result: null as InboxEmail | null, handoffTo: "Courier" }
  );

  const inboxDraft = await step<InboxDraft | null>(
    { agent: "Courier", phase: "Drafting a reply", tool: "Email", tier: "heavy", input: urgent ? `Reply to "${urgent.subject}"` : "No urgent email" },
    async () => {
      if (!urgent) return { narration: "No reply to draft today.", foundItems: [], modelUsed: false, handoffTo: "Nudge", handoffSummary: "nothing waiting in the inbox", result: null };
      const ticket = facts.tickets.find((t) => t.key === urgent.linkedTicket) ?? planned.picks.find((p) => urgent.body.includes(p.id))?.ticket;
      const firstTask = planned.plan.find((b) => b.kind === "task" && b.ticketKey === ticket?.key);
      const fallback = () => replyFallback(urgent, ticket, profile, firstTask?.end, tz);
      const reply = await modelJSON(
        {
          tier: "heavy",
          system: `You are Courier inside Nudge. Draft a short email reply (3–5 sentences) from the developer saying they are on it, naming the ticket and when they'll update. Sign with their first name.\n${VOICE_RULES}\nReturn {"subject":"Re: ...","body":"..."}.`,
          user: JSON.stringify({ email: { from: urgent.from, subject: urgent.subject, body: urgent.body }, developer: profile.name, ticket: ticket && { key: ticket.key, title: ticket.title }, plannedUntil: firstTask ? spokenTime(firstTask.end, tz) : null }),
          schema: ReplySchema,
        },
        fallback
      );
      const action = await queueSessionAction({
        actionType: "send_email",
        summary: `Reply to ${urgent.from}: ${reply.value.subject}`,
        payload: { to: urgent.fromEmail, subject: reply.value.subject, body: reply.value.body, inReplyTo: urgent.id },
        reason: ticket ? `Urgent email linked to ${ticket.key}` : "Urgent email",
        runId,
        sessionKey,
      });
      return {
        narration: `Reply to ${firstName(urgent.from)} drafted${ticket ? `, pointing to ${ticket.key}` : ""}; it waits for your OK.`,
        foundItems: [{ kind: "draft", label: reply.value.subject, detail: `To ${urgent.from}` }],
        modelUsed: reply.modelUsed,
        handoffTo: "Nudge",
        handoffSummary: "passing 1 reply draft",
        result: { email: urgent, reply: reply.value, pendingActionId: action.id },
      };
    },
    { narration: "I couldn't draft the reply; the email is still in your inbox.", result: null, handoffTo: "Nudge" }
  );

  const briefing: Briefing = {
    userName: firstName(profile.name),
    dateISO: now.toISOString(),
    mismatch: tracked.mismatch,
    picks: planned.picks,
    events: planned.events,
    gaps: planned.gaps,
    plan: planned.plan,
    standup: reported.standup,
    standupActionId: reported.standupActionId,
    inbox: inboxDraft,
    todo: planned.candidates.filter((t) => !planned.picks.some((p) => p.id === t.key)),
  };
  await db.update(agentRuns).set({ briefing }).where(eq(agentRuns.id, runId));

  /* ---------------- Nudge: the scene script ---------------- */
  await step(
    { agent: "Nudge", phase: "Writing your briefing", tool: "Orchestrator", tier: "heavy", input: "Everything the team found" },
    async () => {
      const { script, source, modelUsed } = await generateSceneScript(briefing, { demo: ds.mode === "demo", tz });
      // A client that already fell back keeps what it spoke, so Replay matches.
      await db.update(agentRuns).set({ sceneScript: script, scriptSource: source }).where(and(eq(agentRuns.id, runId), isNull(agentRuns.scriptSource)));
      return {
        narration: `Your briefing is ready: ${plural(script.scenes.length, "scene")}${briefing.mismatch ? `, starting with ${briefing.mismatch.ticket.key}` : ""}.`,
        foundItems: [],
        modelUsed,
        result: null,
      };
    },
    { narration: "I'll brief you from a simple template this time.", result: null }
  );

  const run = await db.select({ scriptSource: agentRuns.scriptSource }).from(agentRuns).where(eq(agentRuns.id, runId)).get();
  if (!run?.scriptSource) {
    await db.update(agentRuns).set({ sceneScript: buildTemplateScript(briefing, undefined, tz), scriptSource: "template" }).where(eq(agentRuns.id, runId));
  }
  await finishRun(runId, "done", `${briefing.picks.length} picks, ${briefing.mismatch ? "1 ticket to move, " : ""}standup drafted${briefing.inbox ? ", 1 reply waiting" : ""}.`);
}

/** Today's plan_day run for this session, if any (latest first). */
export async function todaysBriefingRun(ctx: RequestContext, tz?: string) {
  const since = startOfLocalDay(new Date(), safeZone(tz));
  return (
    (await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.trigger, "plan_day"), eq(agentRuns.sessionKey, ctx.sessionKey), gte(agentRuns.startedAt, since)))
      .orderBy(desc(agentRuns.startedAt))
      .get()) ?? null
  );
}

const STALE_MS = 3 * 60 * 1000;

/** Reuses today's run for this session unless `force`; otherwise starts the pipeline in the background. */
export async function startBriefing(ctx: RequestContext, opts: { force?: boolean } = {}) {
  const ds = await getDataSource(ctx);
  const profile = await ds.memory.profile().catch(() => null);
  const existing = await todaysBriefingRun(ctx, profile?.timezone);
  if (existing) {
    const stale = existing.status === "running" && Date.now() - (existing.startedAt?.getTime() ?? 0) > STALE_MS;
    if (stale) await finishRun(existing.id, "failed");
    else if (existing.status === "running" || (!opts.force && existing.status === "done" && existing.briefing)) return { runId: existing.id, started: false };
  }
  const runId = await createRun("plan_day", "Plan my day", ctx.sessionKey);
  const work = runBriefing(runId, ds).catch(async (error) => {
    console.error("briefing failed", error);
    await finishRun(runId, "failed");
  });
  try {
    after(() => work);
  } catch {
    // Outside a request scope the promise simply runs on.
  }
  return { runId, started: true };
}
