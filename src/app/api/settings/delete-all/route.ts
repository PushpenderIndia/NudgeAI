import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  emails,
  drafts,
  tasks,
  jiraIssues,
  gitActivity,
  pendingActions,
  memories,
  activityLog,
  settings,
} from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wipes the user's data. Keeps config (skills, reminders) and resets settings
 * to defaults. To restore the demo afterwards, run `npm run seed`.
 */
export async function POST() {
  await db.delete(activityLog);
  await db.delete(pendingActions);
  await db.delete(drafts);
  await db.delete(memories);
  await db.delete(gitActivity);
  await db.delete(jiraIssues);
  await db.delete(tasks);
  await db.delete(emails);
  await db.delete(meetings);

  await db.delete(settings);
  await db.insert(settings).values({ id: "default" });

  return NextResponse.json({ ok: true });
}
