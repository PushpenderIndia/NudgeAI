import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { skills } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, enabled } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Missing skill id." }, { status: 400 });
  await db.update(skills).set({ enabled: Boolean(enabled) }).where(eq(skills.id, id));
  return NextResponse.json({ ok: true });
}
