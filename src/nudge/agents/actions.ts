import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions } from "@/db/schema";

export async function getSessionAction(id: string | null | undefined, sessionKey: string) {
  if (!id) return null;
  return (await db.select().from(pendingActions).where(and(eq(pendingActions.id, id), eq(pendingActions.sessionKey, sessionKey))).get()) ?? null;
}

export async function updateActionPayload(id: string, payload: Record<string, unknown>, summary?: string) {
  await db.update(pendingActions).set({ payload, ...(summary ? { summary } : {}) }).where(eq(pendingActions.id, id));
}
