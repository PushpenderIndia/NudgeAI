import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import type { ReminderKind } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

/**
 * Fires a reminder now: logs it (so it shows in the Activity Feed and the bell)
 * and stamps lastFiredAt. Uses the stored friendly message, so it works with no
 * API key. Returns the message for the "Run now" demo control.
 */
export async function runReminder(kind: ReminderKind): Promise<{ message: string }> {
  const row = await db.select().from(reminders).where(eq(reminders.kind, kind)).get();
  const settings = await getSettings();
  const fallback: Record<string, string> = {
    timesheet: "Hoo's got a timesheet due? You do! Don't forget before you clock off.",
    eod: "Winding down? Here's what you handled today — nice work.",
    weekly: "It's Friday — your weekly update is ready to review.",
    custom: `A gentle nudge for you, ${settings.userName}.`,
  };
  const message = row?.message ?? fallback[kind] ?? fallback.custom;

  await db.update(reminders).set({ lastFiredAt: new Date() }).where(eq(reminders.kind, kind));
  await logActivity({ action: "Reminder", summary: message, entityType: "reminder", entityId: kind });

  return { message };
}

const CRON_FOR_KIND: Record<string, string> = {
  timesheet: "0 17 * * 5", // Fri 5pm
  eod: "30 17 * * *", // daily 5:30pm
  weekly: "0 16 * * 5", // Fri 4pm
};

let started = false;

/** Starts the background scheduler once (called from instrumentation). */
export async function startScheduler() {
  if (started) return;
  started = true;

  try {
    const cron = (await import("node-cron")).default;
    const rows = await db.select().from(reminders);
    for (const r of rows) {
      const expr = CRON_FOR_KIND[r.kind];
      if (!r.enabled || !expr) continue;
      cron.schedule(expr, () => {
        runReminder(r.kind).catch((e) => console.error("Reminder failed:", e));
      });
    }
    console.log(`🦉 Nudge scheduler started (${rows.filter((r) => r.enabled && CRON_FOR_KIND[r.kind]).length} reminders).`);
  } catch (err) {
    console.error("Scheduler failed to start:", err);
  }
}
