import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { meetings, tasks, pendingActions, activityLog, emails } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { formatTime } from "@/lib/utils";
import { TodayDashboard } from "@/components/today/TodayDashboard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const settings = await getSettings();

  const mtgs = await db.select().from(meetings).orderBy(asc(meetings.startsAt));
  const todoTasks = await db.select().from(tasks).where(eq(tasks.status, "todo")).orderBy(asc(tasks.sortOrder));
  const pending = await db.select().from(pendingActions).where(eq(pendingActions.status, "pending"));
  const activityRows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(12);
  const emailRows = await db.select().from(emails);

  const meetingsDTO = mtgs.map((m) => ({
    id: m.id,
    title: m.title,
    time: `${formatTime(m.startsAt)} – ${formatTime(m.endsAt)}`,
    attendees: m.attendees.length,
  }));

  const tasksDTO = todoTasks.slice(0, 5).map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    source: t.source,
  }));

  const activityDTO = activityRows.map((a) => ({
    action: a.action,
    summary: a.summary,
    time: a.createdAt ? formatTime(a.createdAt) : "",
  }));

  const urgentTask = todoTasks.find((t) => t.priority === "urgent");
  const urgentEmail = emailRows.find((e) => e.triage === "urgent" && !e.isSent);
  const fallbackTopPriority = urgentTask
    ? urgentTask.title
    : urgentEmail
      ? `Reply to ${urgentEmail.subject}`
      : "You're all caught up — nice work.";

  return (
    <TodayDashboard
      userName={settings.userName}
      meetings={meetingsDTO}
      tasks={tasksDTO}
      pendingCount={pending.length}
      activity={activityDTO}
      fallbackTopPriority={fallbackTopPriority}
    />
  );
}
