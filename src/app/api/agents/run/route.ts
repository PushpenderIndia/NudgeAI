import { NextResponse } from "next/server";
import { and, desc, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { startWorkflow } from "@/ai/agent-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKFLOWS = ["plan_day", "urgent_email", "meeting_ended", "start_day"] as const;

export async function POST(req: Request) {
  const { workflow } = await req.json();
  if (!WORKFLOWS.includes(workflow)) {
    return NextResponse.json({ message: "Unknown workflow." }, { status: 400 });
  }
  return NextResponse.json(await startWorkflow(workflow));
}

/** Recent narrated runs (used by Today to notice work that started elsewhere). */
export async function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
  const runs = await db.select().from(agentRuns)
    .where(and(inArray(agentRuns.trigger, ["plan_day", "urgent_email", "meeting_ended"]), gte(agentRuns.startedAt, new Date(since))))
    .orderBy(desc(agentRuns.startedAt))
    .limit(5);
  return NextResponse.json({ runs });
}
