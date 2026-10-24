import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, drafts, insights, meetingPrep, meetings, pendingActions, tasks } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { formatTime } from "@/lib/utils";
import { toRunView } from "@/lib/agent-runs";
import { ensureDayStarted } from "@/ai/agent-orchestrator";
import { startPlanDay } from "@/ai/agents/plan-day";
import { dayBounds } from "@/ai/agents/context";
import { TodayExperience } from "@/components/today/TodayExperience";

export const dynamic = "force-dynamic";

const NARRATED = ["plan_day", "urgent_email", "meeting_ended"];

export default async function TodayPage() {
  const settings = await getSettings();
  const { dayStart, dayEnd } = dayBounds();

  // Plan the day automatically on the first open each day.
  let latestPlan = await db.select().from(agentRuns).where(eq(agentRuns.trigger, "plan_day")).orderBy(desc(agentRuns.startedAt)).get();
  if (!latestPlan || !latestPlan.startedAt || latestPlan.startedAt < dayStart) {
    const { runId } = await startPlanDay();
    latestPlan = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get();
  }
  // Meeting briefs for the Meetings page (kept from the earlier start-of-day flow).
  void ensureDayStarted().catch((error) => console.error("Meeting briefs failed", error));

  const planSteps = latestPlan ? await db.select().from(agentSteps).where(eq(agentSteps.runId, latestPlan.id)).orderBy(asc(agentSteps.seq)) : [];
  const sideRun = await db.select().from(agentRuns)
    .where(and(inArray(agentRuns.trigger, NARRATED.filter((t) => t !== "plan_day")), eq(agentRuns.status, "running")))
    .orderBy(desc(agentRuns.startedAt)).get();

  // Insights come from the latest plan that produced some.
  const insightRows = latestPlan ? await db.select().from(insights).where(eq(insights.runId, latestPlan.id)).orderBy(asc(insights.sortOrder)) : [];

  const pendingRows = await db.select().from(pendingActions).where(eq(pendingActions.status, "pending")).orderBy(desc(pendingActions.createdAt));
  const draftIds = pendingRows.map((a) => a.draftId).filter((id): id is string => Boolean(id));
  const draftRows = draftIds.length ? await db.select().from(drafts).where(inArray(drafts.id, draftIds)) : [];
  const traceRunIds = [...new Set(pendingRows.map((a) => a.runId).filter((id): id is string => Boolean(id)))];
  const traceRuns = traceRunIds.length ? await db.select().from(agentRuns).where(inArray(agentRuns.id, traceRunIds)) : [];
  const traceSteps = traceRunIds.length ? await db.select().from(agentSteps).where(inArray(agentSteps.runId, traceRunIds)).orderBy(asc(agentSteps.seq)) : [];

  const todoRows = await db.select().from(tasks).where(eq(tasks.status, "todo")).orderBy(asc(tasks.sortOrder));
  const meetingRows = (await db.select().from(meetings).orderBy(asc(meetings.startsAt))).filter((m) => m.startsAt >= dayStart && m.startsAt < dayEnd);
  const prepRows = await db.select().from(meetingPrep);

  return (
    <TodayExperience
      userName={settings.userName}
      dateLabel={new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      demoMode={settings.mode === "demo"}
      planRun={latestPlan ? toRunView(latestPlan, planSteps) : null}
      sideRun={sideRun ? toRunView(sideRun, []) : null}
      insights={insightRows.map((i) => ({ id: i.id, text: i.text, sourceType: i.sourceType, sourceLabel: i.sourceLabel, href: i.href }))}
      approvals={pendingRows.map((a) => {
        const draft = draftRows.find((d) => d.id === a.draftId);
        let content: { subject?: string; body?: string } = {};
        try {
          content = draft ? JSON.parse(draft.content) : {};
        } catch {
          content = { body: draft?.content };
        }
        const run = traceRuns.find((r) => r.id === a.runId);
        const preview = String(content.body ?? a.payload.body ?? a.payload.comment ?? a.payload.title ?? a.summary);
        return {
          id: a.id,
          actionType: a.actionType,
          title: a.summary,
          reason: a.reason ?? (a.actionType === "send_email" ? "Someone is waiting on a reply." : "Ready for your review."),
          subject: content.subject ?? (typeof a.payload.subject === "string" ? a.payload.subject : null),
          preview,
          createdAt: a.createdAt?.toISOString() ?? null,
          trace: run
            ? {
                id: run.id,
                title: run.title,
                status: run.status,
                startedAt: run.startedAt?.toISOString(),
                finishedAt: run.finishedAt?.toISOString() ?? null,
                steps: traceSteps.filter((s) => s.runId === run.id).map((s) => ({
                  id: s.id,
                  agent: s.agent,
                  action: s.action,
                  tool: s.tool,
                  model: s.model,
                  inputSummary: s.inputSummary,
                  outputSummary: s.narration || s.outputSummary,
                  handoffTo: s.handoffTo,
                  status: s.status,
                  startedAt: s.startedAt?.toISOString(),
                  finishedAt: s.finishedAt?.toISOString() ?? null,
                })),
              }
            : null,
        };
      })}
      tasks={todoRows
        .sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent") || a.sortOrder - b.sortOrder)
        .map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due ? formatTime(t.due) : null,
          urgent: t.priority === "urgent",
          source: t.source,
          agent: t.agent ?? (t.source === "manual" ? "You" : "Nudge"),
        }))}
      meetings={meetingRows.map((m) => {
        const prep = prepRows.find((p) => p.meetingId === m.id);
        return {
          id: m.id,
          title: m.title,
          time: formatTime(m.startsAt),
          past: m.endsAt < new Date(),
          status: m.hasMom ? "Minutes ready" : prep?.status === "ready" ? "Prep ready" : prep?.status === "working" ? "Preparing" : null,
        };
      })}
    />
  );
}
