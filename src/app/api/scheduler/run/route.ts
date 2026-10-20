import { NextResponse } from "next/server";
import { runReminder } from "@/scheduler";
import type { ReminderKind } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev/demo control: fire a reminder right now. */
export async function POST(req: Request) {
  const { kind } = (await req.json()) as { kind: ReminderKind };
  if (!kind) return NextResponse.json({ error: "empty", message: "Which reminder?" }, { status: 400 });
  const result = await runReminder(kind);
  return NextResponse.json(result);
}
