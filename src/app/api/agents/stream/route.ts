import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 250;
const MAX_MS = 5 * 60 * 1000;

/**
 * Server-sent events for a run. Every change to the run or its steps is sent as a
 * snapshot `{ runs: [run], steps }` (steps are persisted, so a reload or Replay
 * gets the same data without calling the model again). The stream ends with an
 * `end` event once the run leaves the running state.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const runId = new URL(req.url).searchParams.get("runId");
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string, event?: string) =>
        controller.enqueue(encoder.encode(`${event ? `event: ${event}\n` : ""}data: ${data}\n\n`));
      const started = Date.now();
      let last = "";
      while (!req.signal.aborted && Date.now() - started < MAX_MS) {
        const runs = runId
          ? await db.select().from(agentRuns).where(eq(agentRuns.id, runId))
          : await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(10);
        const steps = runId
          ? await db.select().from(agentSteps).where(eq(agentSteps.runId, runId)).orderBy(asc(agentSteps.seq))
          : [];
        const payload = JSON.stringify({ runs, steps });
        if (payload !== last) {
          send(payload);
          last = payload;
        }
        const complete = runs.length > 0 && runs.every((run) => run.status !== "running");
        if (complete || (!runId && runs.length === 0)) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      if (!req.signal.aborted) {
        send("{}", "end");
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
