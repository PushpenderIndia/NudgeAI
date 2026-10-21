import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, meetingPrep, meetings, pendingActions, tasks } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { formatTime } from "@/lib/utils";
import { ensureDayStarted } from "@/ai/agent-orchestrator";
import { TodayDashboard } from "@/components/today/TodayDashboard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await ensureDayStarted();
  const settings = await getSettings();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const rows = (await db.select().from(meetings).orderBy(asc(meetings.startsAt)))
    .filter((meeting) => meeting.endsAt >= dayStart);
  const prepRows = await db.select().from(meetingPrep);
  const todoRows = await db.select().from(tasks).where(eq(tasks.status, "todo")).orderBy(asc(tasks.sortOrder));
  const pendingRows = await db.select().from(pendingActions).where(eq(pendingActions.status, "pending"));
  const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(12);
  const steps = await db.select().from(agentSteps).orderBy(desc(agentSteps.startedAt)).limit(80);

  const prepByMeeting = new Map(prepRows.map((prep) => [prep.meetingId, prep]));
  const pending = pendingRows.map((action) => ({
    id: action.id,
    title: action.summary,
    why: action.actionType === "send_email" ? "Courier used recent Atlas context to prepare this reply." : "This action is ready for your review.",
    preview: typeof action.payload.body === "string" ? action.payload.body : action.summary,
  }));

  return (
    <TodayDashboard
      userName={settings.userName}
      demoMode={settings.mode === "demo"}
      meetings={rows.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        time: `${formatTime(meeting.startsAt)} – ${formatTime(meeting.endsAt)}`,
        startsAt: meeting.startsAt.toISOString(),
        attendees: meeting.attendees,
        past: meeting.endsAt < new Date(),
        hasMom: meeting.hasMom,
        prep: prepByMeeting.get(meeting.id) ?? null,
      }))}
      tasks={todoRows.slice(0, 8).map((task) => ({
        id: task.id,
        title: task.title,
        source: task.source,
        createdBy: task.source === "email" ? "Courier" : task.source === "meeting" ? "Planner" : "You",
      }))}
      pending={pending}
      runs={runs.map((run) => ({
        id: run.id,
        title: run.title,
        status: run.status,
        startedAt: run.startedAt?.toISOString() ?? "",
        steps: steps.filter((step) => step.runId === run.id).map((step) => ({
          agent: step.agent,
          action: step.action,
          tool: step.tool,
          model: step.model,
          inputSummary: step.inputSummary,
          outputSummary: step.outputSummary,
          status: step.status,
          handoffTo: step.handoffTo,
          startedAt: step.startedAt?.toISOString(),
          finishedAt: step.finishedAt?.toISOString() ?? null,
        })),
      }))}
    />
  );
}
