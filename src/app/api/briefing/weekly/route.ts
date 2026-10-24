import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { getDataSource } from "@/nudge/datasource";
import { startWeeklyUpdate } from "@/nudge/agents/side-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Draft weekly update": Historian collects the week, Reporter drafts it. */
export async function POST() {
  return NextResponse.json(await startWeeklyUpdate(await getDataSource(await getRequestContext())));
}
