import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, meetings, emails, tasks, jiraIssues, gitActivity, drafts } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { weeklyUpdateSkill, type WeeklySection } from "@/skills/weekly-update";
import { logActivity } from "@/lib/activity";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { section } = (await req.json().catch(() => ({}))) as { section?: WeeklySection };

  try {
    const [run] = await db.insert(agentRuns).values({
      trigger: "weekly_update",
      title: section ? `Regenerate weekly ${section}` : "Compile weekly update",
      status: "running",
    }).returning({ id: agentRuns.id });
    const startedAt = new Date();
    await db.insert(agentSteps).values({
      runId: run.id,
      seq: 1,
      agent: "Reporter",
      action: section ? `Regenerate ${section}` : "Compile daily work into a report",
      tool: "Memory, meetings, email, GitHub, Jira",
      model: "Nemotron Ultra",
      inputSummary: section ? `Focus on ${section}.` : "Review this week's connected work.",
      outputSummary: "Editable weekly draft is ready.",
      status: "done",
      startedAt,
      finishedAt: new Date(),
      handoffTo: "Nudge",
    });
    const mtgs = await db.select().from(meetings);
    const emailRows = await db.select().from(emails);
    const git = await db.select().from(gitActivity);
    const jira = await db.select().from(jiraIssues);
    const taskRows = await db.select().from(tasks);

    const doneTasks = taskRows.filter((t) => t.status === "done").map((t) => t.title);

    const sections = await runSkill(weeklyUpdateSkill, {
      meetings: mtgs.map((m) => m.title),
      urgentEmails: emailRows.filter((e) => e.triage === "urgent").map((e) => e.subject),
      commits: git.filter((g) => g.type === "commit").map((g) => g.title),
      prs: git.filter((g) => g.type === "pr").map((g) => g.title),
      jira: jira.map((j) => ({ key: j.key, summary: j.summary, status: j.status })),
      doneTasks: doneTasks.length > 0 ? doneTasks : taskRows.map((t) => t.title),
      focusSection: section,
    });

    const content = JSON.stringify(sections);
    const existing = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.kind, "weekly"), eq(drafts.targetType, "weekly")))
      .get();
    if (existing) {
    await db.update(drafts).set({ content, status: "draft", runId: run.id, updatedAt: new Date() }).where(eq(drafts.id, existing.id));
    } else {
    await db.insert(drafts).values({ kind: "weekly", targetType: "weekly", content, status: "draft", runId: run.id });
    }
    await db.update(agentRuns).set({ status: "done", finishedAt: new Date() }).where(eq(agentRuns.id, run.id));

    await logActivity({ action: "Wrote weekly update", summary: "Compiled your week into a report" });
    const traceSteps = await db.select().from(agentSteps).where(eq(agentSteps.runId, run.id)).orderBy(agentSteps.seq);
    return NextResponse.json({ ...sections, runId: run.id, trace: { id: run.id, title: section ? `Regenerate weekly ${section}` : "Compile weekly update", status: "done", steps: traceSteps } });
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't write your weekly update just now." }, { status: 500 });
  }
}
