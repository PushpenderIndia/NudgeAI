import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions, drafts } from "@/db/schema";
import { saveMemory } from "@/ai/memory";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saves a user's edit to a drafted action. Editing a reply teaches Nudge the
 * user's style — we store the edited phrasing as a style preference.
 */
export async function POST(req: Request) {
  const { id, subject, body } = await req.json();
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();
  if (!action) return NextResponse.json({ error: "not_found", message: "Action not found." }, { status: 404 });

  const payload = { ...action.payload } as Record<string, unknown>;
  if (subject !== undefined) payload.subject = subject;
  if (body !== undefined) payload.body = body;
  // Jira comments carry their text as `comment`; keep it in step with the edited body.
  if (body !== undefined && "comment" in payload) payload.comment = body;
  await db.update(pendingActions).set({ payload }).where(eq(pendingActions.id, id));

  if (action.draftId) {
    const content = JSON.stringify({ subject: payload.subject, body: payload.body });
    await db.update(drafts).set({ content, status: "edited", updatedAt: new Date() }).where(eq(drafts.id, action.draftId));

    // Learn from the edit: remember a snippet of the user's own phrasing.
    if (typeof body === "string" && body.trim().length > 0) {
      const snippet = body.trim().slice(0, 180);
      await saveMemory({
        type: "style",
        content: `When editing replies, the user writes like this: "${snippet}${body.length > 180 ? "…" : ""}"`,
        source: "edited-draft",
      });
    }
  }

  await logActivity({ action: "Edited draft", summary: `You tweaked: ${action.summary}`, entityType: "pending_action", entityId: id });
  return NextResponse.json({ ok: true });
}
