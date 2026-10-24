import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { getDataSource } from "@/nudge/datasource";
import { todaysBriefingRun } from "@/nudge/agents/briefing-run";
import { briefingView } from "@/nudge/agents/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Latest plan_day run for this session today, or null. */
export async function GET() {
  const ctx = await getRequestContext();
  const profile = await getDataSource(ctx).then((ds) => ds.memory.profile()).catch(() => null);
  const run = await todaysBriefingRun(ctx, profile?.timezone);
  return NextResponse.json(run ? await briefingView(run) : null);
}
