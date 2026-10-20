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
  skills,
  activityLog,
  settings,
  reminders,
} from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download everything in the user's local database as one JSON file. */
export async function GET() {
  const data = {
    exportedAt: new Date().toISOString(),
    meetings: await db.select().from(meetings),
    emails: await db.select().from(emails),
    drafts: await db.select().from(drafts),
    tasks: await db.select().from(tasks),
    jiraIssues: await db.select().from(jiraIssues),
    gitActivity: await db.select().from(gitActivity),
    pendingActions: await db.select().from(pendingActions),
    memories: await db.select().from(memories),
    skills: await db.select().from(skills),
    activityLog: await db.select().from(activityLog),
    settings: await db.select().from(settings),
    reminders: await db.select().from(reminders),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="nudge-export.json"',
    },
  });
}
