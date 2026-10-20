import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import type { Mode, Permission } from "@/db/schema";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: s });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    mode?: Mode;
    userName?: string;
    toneDefault?: string;
    permissions?: Record<string, Permission>;
    reminderSchedule?: Record<string, string>;
  };

  const current = await getSettings();

  const next = {
    mode: body.mode ?? current.mode,
    userName: body.userName ?? current.userName,
    toneDefault: body.toneDefault ?? current.toneDefault,
    permissions: body.permissions ? { ...current.permissions, ...body.permissions } : current.permissions,
    reminderSchedule: body.reminderSchedule
      ? { ...current.reminderSchedule, ...body.reminderSchedule }
      : current.reminderSchedule,
  };

  await db.update(settings).set(next).where(eq(settings.id, "default"));
  const updated = await getSettings();
  return NextResponse.json({ settings: updated });
}
