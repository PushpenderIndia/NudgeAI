import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { resetDemoSession } from "@/nudge/datasource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Reset demo": restores the starting story for this browser's session. */
export async function POST() {
  const ctx = await getRequestContext();
  if (!ctx.demo) return NextResponse.json({ ok: false, message: "Not in demo mode." }, { status: 400 });
  await resetDemoSession(ctx.sessionKey);
  return NextResponse.json({ ok: true });
}
