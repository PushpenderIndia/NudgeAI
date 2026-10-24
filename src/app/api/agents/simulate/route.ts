import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { startPlanDay } from "@/ai/agents/plan-day";
import { startUrgentEmail } from "@/ai/agents/urgent-email";
import { startMeetingEnded } from "@/ai/agents/meeting-ended";
import { simulateIncomingEmail } from "@/ai/agents/simulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo mode only: trigger the real workflows on demand (for the demo video). */
export async function POST(req: Request) {
  const settings = await getSettings();
  if (settings.mode !== "demo") {
    return NextResponse.json({ message: "Simulate is only available with demo data." }, { status: 403 });
  }
  const { kind } = await req.json();
  try {
    if (kind === "urgent_email") return NextResponse.json(await startUrgentEmail(await simulateIncomingEmail()));
    if (kind === "meeting_ended") return NextResponse.json(await startMeetingEnded());
    if (kind === "plan_day") return NextResponse.json(await startPlanDay());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "That didn't start." }, { status: 409 });
  }
  return NextResponse.json({ message: "Unknown simulation." }, { status: 400 });
}
