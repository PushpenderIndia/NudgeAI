import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearDemoCookies } from "@/lib/demo-cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  clearDemoCookies(await cookies());
  return NextResponse.json({ ok: true });
}
