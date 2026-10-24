import { after } from "next/server";
import { z } from "zod";
import type { FoundItem } from "@/db/schema";
import { createRun, describePayload, finishRun, stepper } from "@/ai/agents/runs";
import type { CalendarEvent, Commit, DataSource, MeetingNote, PullRequest, Ticket } from "@/nudge/types";
import { backlog, firstName, ticketKeysIn } from "./analysis";
import { modelJSON, VOICE_RULES } from "./model";
import { clockTime, safeZone, spokenTime, startOfLocalDay } from "./time";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const LinesSchema = z.object({ lines: z.array(z.string().min(3)).min(1).max(8) });

function background(work: Promise<unknown>) {
  try {
    after(() => work);
  } catch {
    void work;
  }
}

/** meeting_prep: Scribe reads the invite, Historian pulls related context, Scribe writes talking points. */
export async function startMeetingPrep(ds: DataSource, eventId: string) {
  const profile = await ds.memory.profile();
  const tz = safeZone(profile.timezone);
  const dayFrom = startOfLocalDay(new Date(), tz);
  const events = await ds.calendar.listEvents({ fromISO: dayFrom.toISOString(), toISO: new Date(dayFrom.getTime() + 86400000).toISOString() });
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;
  const runId = await createRun("meeting_prep", `Prep for ${event.title} at ${clockTime(event.start, tz)}`, ds.sessionKey);
  background(
    runMeetingPrep(runId, ds, event, tz).catch(async (error) => {
      console.error("meeting_prep failed", error);
      await finishRun(runId, "failed");
    })
  );
  return { runId };
}

async function runMeetingPrep(runId: string, ds: DataSource, event: CalendarEvent, tz: string) {
  const step = stepper(runId);
  const profile = await ds.memory.profile();
  const others = event.attendees.filter((a) => a.toLowerCase() !== firstName(profile.name).toLowerCase());
  await step(
    { agent: "Scribe", phase: "Reading the invite", tool: "Calendar", tier: "fast", input: event.title },
    async () => ({
      narration: `${event.title} at ${spokenTime(event.start, tz)} with ${others.length ? others.join(", ") : "just you"}.`,
      foundItems: [{ kind: "meeting", label: event.title, detail: `${clockTime(event.start, tz)}–${clockTime(event.end, tz)}` }],
      modelUsed: false,
      handoffTo: "Historian",
      handoffSummary: "asking for past minutes, open tickets and recent PRs",
      result: null,
    }),
    { narration: "I couldn't read the invite details.", result: null, handoffTo: "Historian" }
  );

  const context = await step(
    { agent: "Historian", phase: "Gathering context", tool: "Meetings, Jira, GitHub", tier: "fast", input: "Related minutes, open tickets and PRs" },
    async () => {
      const [meetings, tickets, prs] = await Promise.all([ds.memory.meetings(), ds.jira.listTickets(), ds.github.listPullRequests()]);
      const title = words(event.title);
      const related = meetings.filter((m) => [...words(`${m.title} ${m.minutes}`)].some((w) => title.has(w)));
      const pastMeetings = (related.length ? related : meetings).slice(0, 3);
      const open = backlog({ tickets, profile }).slice(0, 6);
      const openPrs = prs.filter((p) => p.state === "open" && (p.author === profile.name || event.attendees.includes(p.author)));
      const openItems = pastMeetings.flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ ...a, meeting: m.title })));
      return {
        narration: `${plural(pastMeetings.length, "past meeting")} with ${plural(openItems.length, "open item")}, ${plural(open.length, "open ticket")} and ${plural(openPrs.length, "open PR")} to bring up.`,
        foundItems: [
          ...pastMeetings.map((m): FoundItem => ({ kind: "meeting", label: m.title, detail: `${m.actionItems.filter((a) => !a.done).length} open items` })),
          ...openPrs.map((p): FoundItem => ({ kind: "pr", label: `PR #${p.number} ${p.title}`, detail: p.author, href: p.url })),
        ],
        modelUsed: false,
        handoffTo: "Scribe",
        handoffSummary: describePayload([[pastMeetings.length, "meeting", "meetings"], [open.length, "ticket", "tickets"], [openPrs.length, "PR", "PRs"]]),
        result: { pastMeetings, open, openPrs, openItems },
      };
    },
    { narration: "I couldn't reach past minutes or tickets.", result: { pastMeetings: [] as MeetingNote[], open: [] as Ticket[], openPrs: [] as PullRequest[], openItems: [] as { title: string; owner: string; meeting: string }[] }, handoffTo: "Scribe" }
  );

  const points = await step(
    { agent: "Scribe", phase: "Writing talking points", tool: "Meetings", tier: "heavy", input: `Prep for ${event.title}` },
    async () => {
      const fallback = () => ({
        lines: [
          ...context.open.slice(0, 3).map((t) => `${t.key} ${t.title}: ${t.status}, about ${t.estimateHours} h${t.due ? `, due ${t.due}` : ""}`),
          ...context.openPrs.slice(0, 2).map((p) => `PR #${p.number} ${p.title} is open${ticketKeysIn(`${p.branch} ${p.title}`).length ? ` (${ticketKeysIn(`${p.branch} ${p.title}`).join(", ")})` : ""}`),
          ...context.openItems.slice(0, 2).map((a) => `Open from ${a.meeting.split(":")[0]}: ${a.title} (${a.owner})`),
        ].slice(0, 6),
      });
      const out = await modelJSON(
        {
          tier: "heavy",
          system: `You are Scribe inside Nudge. Write 3 to 6 short talking points the developer can bring to this meeting.\n${VOICE_RULES}\nReturn {"lines": ["..."]}.`,
          user: JSON.stringify({ meeting: { title: event.title, start: spokenTime(event.start, tz), attendees: event.attendees }, ...context }),
          schema: LinesSchema,
        },
        fallback
      );
      return {
        narration: `${plural(out.value.lines.length, "talking point")} ready for ${event.title}.`,
        foundItems: [{ kind: "draft", label: `Prep for ${event.title}`, detail: out.value.lines[0] }],
        modelUsed: out.modelUsed,
        result: out.value.lines,
      };
    },
    { narration: "I couldn't write the talking points this time.", result: [] as string[] }
  );
  await finishRun(runId, "done", points.map((l) => `• ${l}`).join("\n") || "No talking points.");
}

/** weekly_update: Historian collects this week's work, Reporter drafts the update. */
export async function startWeeklyUpdate(ds: DataSource) {
  const runId = await createRun("weekly_update", "Draft weekly update", ds.sessionKey);
  background(
    runWeeklyUpdate(runId, ds).catch(async (error) => {
      console.error("weekly_update failed", error);
      await finishRun(runId, "failed");
    })
  );
  return { runId };
}

async function runWeeklyUpdate(runId: string, ds: DataSource) {
  const step = stepper(runId);
  const profile = await ds.memory.profile();
  const tz = safeZone(profile.timezone);
  const since = new Date(startOfLocalDay(new Date(), tz).getTime() - 6 * 86400000);
  const week = await step(
    { agent: "Historian", phase: "Collecting this week", tool: "GitHub, Jira", tier: "fast", input: "Commits, closed tickets and merged PRs since last week" },
    async () => {
      const [commits, tickets, prs] = await Promise.all([ds.github.listCommits({ sinceISO: since.toISOString() }), ds.jira.listTickets(), ds.github.listPullRequests()]);
      const inWeek = (iso?: string | null) => Boolean(iso && new Date(iso) >= since);
      const weekCommits = commits.filter((c) => inWeek(c.at));
      const closed = tickets.filter((t) => t.status === "Done" && inWeek(t.closedAt));
      const merged = prs.filter((p) => p.state === "merged" && inWeek(p.mergedAt));
      const open = prs.filter((p) => p.state === "open" && p.author === profile.name);
      const days = new Set(weekCommits.map((c) => c.at.slice(0, 10))).size;
      return {
        narration: `${plural(weekCommits.length, "commit")} over ${plural(days, "day")}, ${plural(closed.length, "closed ticket")} and ${plural(merged.length, "merged PR")} this week.`,
        foundItems: [
          ...merged.map((p): FoundItem => ({ kind: "pr", label: `PR #${p.number} ${p.title}`, detail: "merged", href: p.url })),
          ...closed.map((t): FoundItem => ({ kind: "jira", label: `${t.key} ${t.title}`, detail: "Done", href: t.url })),
        ].slice(0, 6),
        modelUsed: false,
        handoffTo: "Reporter",
        handoffSummary: describePayload([[closed.length, "closed ticket", "closed tickets"], [merged.length, "merged PR", "merged PRs"]]),
        result: { weekCommits, closed, merged, open, next: backlog({ tickets, profile }).slice(0, 3) },
      };
    },
    { narration: "I couldn't reach GitHub or Jira for this week.", result: { weekCommits: [] as Commit[], closed: [] as Ticket[], merged: [] as PullRequest[], open: [] as PullRequest[], next: [] as Ticket[] }, handoffTo: "Reporter" }
  );

  const lines = await step(
    { agent: "Reporter", phase: "Drafting your weekly update", tool: "Slack", tier: "heavy", input: "This week's shipped work and what's next" },
    async () => {
      const fallback = () => ({
        lines: [
          ...week.merged.map((p) => `Shipped PR #${p.number} ${p.title}`),
          week.closed.length ? `Closed ${week.closed.map((t) => t.key).join(", ")}` : "",
          ...week.open.map((p) => `In review: PR #${p.number} ${p.title}`),
          week.next.length ? `Next: ${week.next.map((t) => `${t.key} ${t.title}`).join("; ")}` : "",
        ].filter(Boolean).slice(0, 8),
      });
      const out = await modelJSON(
        {
          tier: "heavy",
          system: `You are Reporter inside Nudge. Draft the developer's weekly update as 4 to 7 short lines: shipped, closed, in review, next.\n${VOICE_RULES}\nReturn {"lines": ["..."]}.`,
          user: JSON.stringify({
            merged: week.merged.map((p) => ({ number: p.number, title: p.title })),
            closed: week.closed.map((t) => ({ key: t.key, title: t.title })),
            inReview: week.open.map((p) => ({ number: p.number, title: p.title })),
            commits: week.weekCommits.length,
            next: week.next.map((t) => ({ key: t.key, title: t.title })),
          }),
          schema: LinesSchema,
        },
        fallback
      );
      return {
        narration: `Weekly update drafted: ${plural(out.value.lines.length, "line")}, from ${plural(week.merged.length, "merged PR")} and ${plural(week.closed.length, "closed ticket")}.`,
        foundItems: [{ kind: "draft", label: "Weekly update", detail: out.value.lines[0] }],
        modelUsed: out.modelUsed,
        result: out.value.lines,
      };
    },
    { narration: "I couldn't draft the weekly update this time.", result: [] as string[] }
  );
  await finishRun(runId, "done", lines.map((l) => `• ${l}`).join("\n") || "Nothing to report this week.");
}
