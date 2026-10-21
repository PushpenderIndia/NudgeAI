import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, tasks } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { TaskList, type TaskDTO } from "@/components/tasks/TaskList";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const rows = await db.select().from(tasks).orderBy(asc(tasks.sortOrder));
  const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt));
  const steps = await db.select().from(agentSteps).orderBy(asc(agentSteps.seq));
  const initial: TaskDTO[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    source: t.source,
    due: t.due ? t.due.toISOString() : null,
    createdBy: t.source === "meeting" ? "Scribe" : t.source === "email" ? "Courier" : t.source === "jira" ? "Tracker" : "You",
    run: t.runId ? (() => {
      const run = runs.find((candidate) => candidate.id === t.runId);
      return run ? { id: run.id, title: run.title, status: run.status, steps: steps.filter((step) => step.runId === run.id).map((step) => ({ id: step.id, agent: step.agent, action: step.action, tool: step.tool, model: step.model, inputSummary: step.inputSummary, outputSummary: step.outputSummary, handoffTo: step.handoffTo, status: step.status, startedAt: step.startedAt?.toISOString(), finishedAt: step.finishedAt?.toISOString() ?? null })) } : null;
    })() : null,
  }));

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="See where each task came from, then decide what to do next."
      />
      <TaskList initial={initial} />
    </div>
  );
}
