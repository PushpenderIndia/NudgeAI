import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const stream = new ReadableStream({
    async start(controller) {
      let last = "";
      for (let attempt = 0; attempt < 30; attempt++) {
        const runs = runId
          ? await db.select().from(agentRuns).where(eq(agentRuns.id, runId))
          : await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(10);
        const steps = runId
          ? await db.select().from(agentSteps).where(eq(agentSteps.runId, runId)).orderBy(agentSteps.seq)
          : [];
        const payload = JSON.stringify({ runs, steps });
        if (payload !== last) {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          last = payload;
        }
        const complete = runs.length > 0 && runs.every((run) => run.status !== "running");
        if (runId && complete) break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
