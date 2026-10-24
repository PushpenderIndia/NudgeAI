import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEMO_KEY_COOKIE, newDemoKey, writeDemoCookies } from "@/lib/demo-cookies";
import { getDemoState } from "@/nudge/datasource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Try the demo": gives this browser a demo session (reusing an existing one). */
export async function POST() {
  const store = await cookies();
  const sessionKey = store.get(DEMO_KEY_COOKIE)?.value || newDemoKey();
  writeDemoCookies(store, sessionKey);
  await getDemoState(sessionKey);
  return NextResponse.json({ sessionKey });
}
