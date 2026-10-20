import { NextResponse } from "next/server";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { emails, tasks } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { emailTriageSkill } from "@/skills/email-triage";
import { taskExtractorSkill } from "@/skills/task-extractor";
import { logActivity } from "@/lib/activity";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureUrgentTask(email: typeof emails.$inferSelect) {
  const existing = await db.select().from(tasks).where(eq(tasks.sourceId, email.id)).get();
  if (existing) return false;

  let title = email.subject;
  let priority: "today" | "this_week" | "urgent" = "urgent";
  try {
    const t = await runSkill(taskExtractorSkill, {
      fromName: email.fromName,
      subject: email.subject,
      body: email.body,
    });
    title = t.title;
    priority = t.priority;
  } catch {
    // Fall back to the subject line if extraction fails.
  }

  await db.insert(tasks).values({
    title,
    priority,
    source: "email",
    sourceId: email.id,
    sortOrder: Date.now(),
  });
  await logActivity({
    action: "Created task",
    summary: `Flagged "${title}" from an urgent email`,
    entityType: "email",
    entityId: email.id,
  });
  return true;
}

export async function POST(req: Request) {
  const { emailId } = await req.json().catch(() => ({}));

  try {
    const targets = emailId
      ? await db.select().from(emails).where(eq(emails.id, emailId))
      : await db.select().from(emails).where(and(isNull(emails.triage), eq(emails.isSent, false)));

    let triaged = 0;
    let tasksCreated = 0;

    for (const email of targets) {
      const result = await runSkill(emailTriageSkill, {
        fromName: email.fromName,
        subject: email.subject,
        body: email.body,
      });
      await db
        .update(emails)
        .set({ triage: result.triage, triageReason: result.reason })
        .where(eq(emails.id, email.id));
      triaged++;

      if (result.triage === "urgent") {
        const created = await ensureUrgentTask(email);
        if (created) tasksCreated++;
      }
    }

    if (triaged > 0) {
      await logActivity({
        action: "Triaged inbox",
        summary: `Sorted ${triaged} email${triaged === 1 ? "" : "s"}${tasksCreated ? `, created ${tasksCreated} urgent task${tasksCreated === 1 ? "" : "s"}` : ""}`,
      });
    }

    return NextResponse.json({ triaged, tasksCreated });
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't triage your inbox just now." }, { status: 500 });
  }
}
