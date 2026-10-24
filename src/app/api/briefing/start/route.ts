import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { startBriefing } from "@/nudge/agents/briefing-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Starts (or reuses) today's plan_day run for this session. Also the landing-page prefetch. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const ctx = await getRequestContext();
  const { runId } = await startBriefing(ctx, { force: Boolean(body.force) });
  return NextResponse.json({ runId });
}
