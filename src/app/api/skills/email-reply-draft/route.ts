import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { emails, drafts, pendingActions } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { emailReplyDraftSkill } from "@/skills/email-reply-draft";
import { queueAction } from "@/ai/approvals";
import { getSettings } from "@/lib/settings";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { emailId, tone, instruction } = await req.json();
  const email = await db.select().from(emails).where(eq(emails.id, emailId)).get();
  if (!email) {
    return NextResponse.json({ error: "not_found", message: "Email not found." }, { status: 404 });
  }

  const settings = await getSettings();
  const useTone = tone ?? settings.toneDefault;

  try {
    const draft = await runSkill(emailReplyDraftSkill, {
      fromName: email.fromName,
      subject: email.subject,
      body: email.body,
      tone: useTone,
      instruction,
    });

    const content = JSON.stringify(draft);

    // Upsert the draft for this email.
    const existingDraft = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.targetId, emailId), eq(drafts.kind, "email_reply")))
      .get();

    let draftId: string;
    if (existingDraft) {
      await db.update(drafts).set({ content, tone: useTone, status: "draft", updatedAt: new Date() }).where(eq(drafts.id, existingDraft.id));
      draftId = existingDraft.id;
    } else {
      const [row] = await db
        .insert(drafts)
        .values({ kind: "email_reply", targetType: "email", targetId: emailId, content, tone: useTone, status: "draft" })
        .returning();
      draftId = row.id;
    }

    const payload = {
      emailId,
      to: email.fromEmail,
      toName: email.fromName,
      subject: draft.subject,
      body: draft.body,
    };
    const summary = `Send reply to ${email.fromName}: "${draft.subject}"`;

    // Reuse an existing pending action for this draft, else queue a new one.
    const existingAction = await db
      .select()
      .from(pendingActions)
      .where(and(eq(pendingActions.draftId, draftId), eq(pendingActions.status, "pending")))
      .get();

    let actionId: string;
    if (existingAction) {
      await db.update(pendingActions).set({ payload, summary }).where(eq(pendingActions.id, existingAction.id));
      actionId = existingAction.id;
    } else {
      const action = await queueAction({ actionType: "send_email", summary, payload, draftId });
      actionId = action.id;
    }

    return NextResponse.json({ draft, actionId, tone: useTone });
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't draft that reply just now." }, { status: 500 });
  }
}
