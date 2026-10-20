import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { meetings, emails, tasks, jiraIssues, gitActivity } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { morningBriefSkill } from "@/skills/morning-brief";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timeOf(d: Date) {
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

export async function POST() {
  try {
    const settings = await getSettings();
    const mtgs = await db.select().from(meetings).orderBy(asc(meetings.startsAt));
    const emailRows = await db.select().from(emails);
    const taskRows = await db.select().from(tasks).where(eq(tasks.status, "todo"));
    const jira = await db.select().from(jiraIssues);
    const commitsCount = (await db.select().from(gitActivity)).filter((g) => g.type === "commit").length;

    const brief = await runSkill(morningBriefSkill, {
      userName: settings.userName,
      meetings: mtgs.map((m) => ({ title: m.title, time: timeOf(m.startsAt) })),
      urgentEmails: emailRows
        .filter((e) => e.triage === "urgent" && !e.isSent)
        .map((e) => ({ from: e.fromName, subject: e.subject })),
      tasks: taskRows.map((t) => ({ title: t.title, priority: t.priority })),
      jira: jira.map((j) => ({ key: j.key, summary: j.summary, status: j.status })),
      commitsCount,
    });

    await logActivity({ action: "Wrote morning brief", summary: "Summarised your day" });
    return NextResponse.json(brief);
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't write your brief just now." }, { status: 500 });
  }
}
