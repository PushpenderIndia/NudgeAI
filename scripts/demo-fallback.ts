/**
 * Writes demo/fallback-script.json: the never-fail scene script, built from the demo seed with
 * the same deterministic analysis and template the live pipeline uses. Action ids are
 * placeholders substituted per session at load time. Run: npm run demo:fallback
 */
import { writeFileSync } from "fs";
import path from "path";
import { buildSeed, DEMO_WORKDAY } from "@demo/seed";
import type { Briefing } from "@/nudge/briefing";
import {
  backlog,
  buildPlan,
  buildStandup,
  findGaps,
  findMismatch,
  firstName,
  rankFallback,
  replyFallback,
  standupFacts,
  todaysEvents,
  triageFallback,
  type Facts,
} from "@/nudge/agents/analysis";
import { buildTemplateScript, FALLBACK_PLACEHOLDERS } from "@/nudge/agents/script";
import { safeZone } from "@/nudge/agents/time";

const now = new Date();
const seed = buildSeed(now);
const tz = safeZone(seed.profile.timezone);
const facts: Facts = { now, tz, profile: seed.profile, tickets: seed.tickets, pullRequests: seed.pullRequests, commits: seed.commits, events: [], inbox: seed.inbox, notes: seed.notes, meetings: seed.meetings };
facts.events = todaysEvents({ now, tz, events: seed.events });

const found = findMismatch(facts);
const mismatch = found && { ...found, pendingActionId: FALLBACK_PLACEHOLDERS.catch };
const gaps = findGaps(facts.events, now, tz, DEMO_WORKDAY);
const candidates = backlog(facts, mismatch ? [mismatch.ticket.key] : []);
const picks = rankFallback(candidates, { facts, events: facts.events, gaps });
const plan = buildPlan(facts.events, gaps, picks.map((p) => p.ticket));
const urgent = triageFallback(seed.inbox);
const ticket = seed.tickets.find((t) => t.key === urgent?.linkedTicket);

const briefing: Briefing = {
  userName: firstName(seed.profile.name),
  dateISO: now.toISOString(),
  mismatch,
  picks,
  events: facts.events,
  gaps,
  plan,
  standup: buildStandup(standupFacts(facts), { plan, picks, mismatch, profile: seed.profile }),
  standupActionId: FALLBACK_PLACEHOLDERS.post,
  inbox: urgent && { email: urgent, reply: replyFallback(urgent, ticket, seed.profile), pendingActionId: "" },
  todo: candidates.filter((t) => !picks.some((p) => p.id === t.key)),
};

const out = path.join(process.cwd(), "demo", "fallback-script.json");
writeFileSync(out, `${JSON.stringify(buildTemplateScript(briefing, undefined, tz), null, 2)}\n`);
console.log(`Wrote ${out}`);
