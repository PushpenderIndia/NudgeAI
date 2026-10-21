import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, meetings, drafts } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { meetingToMomSkill } from "@/skills/meeting-to-mom";
import { logActivity } from "@/lib/activity";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { meetingId } = await req.json();
  const meeting = await db.select().from(meetings).where(eq(meetings.id, meetingId)).get();

  if (!meeting) {
    return NextResponse.json({ error: "not_found", message: "Meeting not found." }, { status: 404 });
  }
  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "no_transcript", message: "This meeting has no transcript yet, so there's nothing to summarise." },
      { status: 400 }
    );
  }

  try {
    const [run] = await db.insert(agentRuns).values({
      trigger: "meeting_to_mom",
      title: `Write minutes: ${meeting.title}`,
      status: "running",
    }).returning({ id: agentRuns.id });
    const startedAt = new Date();
    await db.insert(agentSteps).values({
      runId: run.id,
      seq: 1,
      agent: "Scribe",
      action: "Read transcript and write minutes",
      tool: "Meetings",
      model: "Nemotron Ultra",
      inputSummary: meeting.title,
      outputSummary: "Minutes draft is ready for review.",
      status: "done",
      startedAt,
      finishedAt: new Date(),
      handoffTo: "Planner",
    });
    const mom = await runSkill(meetingToMomSkill, {
      title: meeting.title,
      attendees: meeting.attendees,
      transcript: meeting.transcript,
    });

    await db.insert(drafts).values({
      kind: "mom",
      targetType: "meeting",
      targetId: meeting.id,
      content: JSON.stringify(mom),
      status: "draft",
      runId: run.id,
    });
    await db.update(meetings).set({ hasMom: true }).where(eq(meetings.id, meeting.id));
    await db.update(agentRuns).set({ status: "done", finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
    await logActivity({
      action: "Summarised meeting",
      summary: `Wrote minutes for "${meeting.title}"`,
      entityType: "meeting",
      entityId: meeting.id,
    });

    return NextResponse.json({ mom });
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Something went wrong writing the minutes." }, { status: 500 });
  }
}
