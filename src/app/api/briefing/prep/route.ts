import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/nudge/session";
import { getDataSource } from "@/nudge/datasource";
import { startMeetingPrep } from "@/nudge/agents/side-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Prep me for 14:00": a narrated Scribe + Historian run for one of today's events. */
export async function POST(req: Request) {
  const parsed = z.object({ eventId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "eventId is required." }, { status: 400 });
  const started = await startMeetingPrep(await getDataSource(await getRequestContext()), parsed.data.eventId);
  if (!started) return NextResponse.json({ message: "That meeting isn't on today's calendar." }, { status: 404 });
  return NextResponse.json(started);
}
