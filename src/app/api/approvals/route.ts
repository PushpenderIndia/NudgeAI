import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions, drafts } from "@/db/schema";
import { flushDueApprovals } from "@/ai/approvals";
import { getRequestContext } from "@/nudge/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists everything awaiting the user's OK in this (live or demo) session, with the draft content if any. */
export async function GET() {
  await flushDueApprovals();
  const { sessionKey } = await getRequestContext();
  const rows = await db
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.status, "pending"), eq(pendingActions.sessionKey, sessionKey)));

  const enriched = await Promise.all(
    rows.map(async (a) => {
      let draftContent: unknown = null;
      if (a.draftId) {
        const d = await db.select().from(drafts).where(eq(drafts.id, a.draftId)).get();
        if (d) {
          try {
            draftContent = JSON.parse(d.content);
          } catch {
            draftContent = d.content;
          }
        }
      }
      return {
        id: a.id,
        actionType: a.actionType,
        summary: a.summary,
        payload: a.payload,
        draftId: a.draftId,
        draftContent,
        createdAt: a.createdAt,
      };
    })
  );

  return NextResponse.json({ pending: enriched });
}
