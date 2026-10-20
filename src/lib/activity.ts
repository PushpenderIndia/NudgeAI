import { db } from "@/db";
import { activityLog } from "@/db/schema";

/** Records something Nudge did, surfaced in the Activity Feed. */
export async function logActivity(input: {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
}) {
  await db.insert(activityLog).values({
    action: input.action,
    summary: input.summary,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}
