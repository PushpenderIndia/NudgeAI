import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent reminders for the notification bell. */
export async function GET() {
  const rows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.action, "Reminder"))
    .orderBy(desc(activityLog.createdAt))
    .limit(10);
  return NextResponse.json({
    notifications: rows.map((r) => ({ id: r.id, message: r.summary, createdAt: r.createdAt })),
  });
}
