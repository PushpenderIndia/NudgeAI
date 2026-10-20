import { asc } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { TaskList, type TaskDTO } from "@/components/tasks/TaskList";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const rows = await db.select().from(tasks).orderBy(asc(tasks.sortOrder));
  const initial: TaskDTO[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    source: t.source,
    due: t.due ? t.due.toISOString() : null,
  }));

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="One to-do list pulled from your meetings, emails and Jira — plus anything you add. Drag to reorder."
      />
      <TaskList initial={initial} />
    </div>
  );
}
