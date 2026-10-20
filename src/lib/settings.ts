import { db } from "@/db";
import { settings } from "@/db/schema";
import type { Settings } from "@/db/schema";

const DEFAULTS = {
  id: "default" as const,
};

/** Returns the singleton settings row, creating it if missing. */
export async function getSettings(): Promise<Settings> {
  let row = await db.select().from(settings).get();
  if (!row) {
    await db.insert(settings).values(DEFAULTS);
    row = await db.select().from(settings).get();
  }
  return row!;
}
