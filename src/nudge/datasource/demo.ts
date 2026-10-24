import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, demoSessions, pendingActions } from "@/db/schema";
import { buildSeed } from "@demo/seed";
import type { DataSource, DemoState } from "@/nudge/types";

/** Per-session demo world, persisted as JSON in demo_sessions (created from the seed on first access). */
export async function getDemoState(key: string): Promise<DemoState> {
  const row = await db.select().from(demoSessions).where(eq(demoSessions.key, key)).get();
  if (row) return row.state;
  const state = buildSeed(new Date());
  await db.insert(demoSessions).values({ key, state }).onConflictDoNothing();
  return (await db.select().from(demoSessions).where(eq(demoSessions.key, key)).get())?.state ?? state;
}

/** Read-modify-write on one session's world. */
async function mutate<T>(key: string, fn: (state: DemoState) => T): Promise<T> {
  const state = await getDemoState(key);
  const result = fn(state);
  await db.update(demoSessions).set({ state, updatedAt: new Date() }).where(eq(demoSessions.key, key));
  return result;
}

/** Re-seeds the session and forgets its runs, steps and approvals. */
export async function resetDemoSession(key: string): Promise<void> {
  const state = buildSeed(new Date());
  await db
    .insert(demoSessions)
    .values({ key, state })
    .onConflictDoUpdate({ target: demoSessions.key, set: { state, updatedAt: new Date() } });
  const runs = await db.select({ id: agentRuns.id }).from(agentRuns).where(eq(agentRuns.sessionKey, key));
  if (runs.length > 0) {
    await db.delete(agentSteps).where(inArray(agentSteps.runId, runs.map((r) => r.id)));
    await db.delete(agentRuns).where(eq(agentRuns.sessionKey, key));
  }
  await db.delete(pendingActions).where(eq(pendingActions.sessionKey, key));
}

export function demoDataSource(key: string): DataSource {
  const read = () => getDemoState(key);
  return {
    mode: "demo",
    sessionKey: key,
    github: {
      listPullRequests: async () => (await read()).pullRequests,
      listCommits: async (opts) => {
        const since = opts?.sinceISO ? Date.parse(opts.sinceISO) : 0;
        return (await read()).commits.filter((c) => Date.parse(c.at) >= since);
      },
    },
    jira: {
      listTickets: async () => (await read()).tickets,
      transition: (ticketKey, to) =>
        mutate(key, (s) => {
          const t = s.tickets.find((x) => x.key === ticketKey);
          if (!t) throw new Error(`No ticket ${ticketKey} on the board.`);
          t.status = to;
          t.closedAt = to === "Done" ? new Date().toISOString() : null;
          return { ...t };
        }),
    },
    calendar: {
      listEvents: async ({ fromISO, toISO }) => {
        const from = Date.parse(fromISO);
        const to = Date.parse(toISO);
        return (await read()).events.filter((e) => Date.parse(e.end) > from && Date.parse(e.start) < to);
      },
    },
    email: {
      listInbox: async () => (await read()).inbox,
      listOutbox: async () => (await read()).outbox,
      send: (email) =>
        mutate(key, (s) => {
          const sent = { ...email, id: randomUUID(), sentAt: new Date().toISOString() };
          s.outbox.unshift(sent);
          return sent;
        }),
    },
    slack: {
      listChannel: async (channel) => (await read()).slack.filter((m) => m.channel === channel),
      post: (channel, text) =>
        mutate(key, (s) => {
          const msg = { id: randomUUID(), channel, author: s.profile.name, text, postedAt: new Date().toISOString() };
          s.slack.push(msg);
          return msg;
        }),
    },
    memory: {
      profile: async () => (await read()).profile,
      notes: async () => (await read()).notes,
      meetings: async () => (await read()).meetings,
    },
  };
}
