import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "bad", message: "Expected an array of ids." }, { status: 400 });
  }
  for (let i = 0; i < ids.length; i++) {
    await db.update(tasks).set({ sortOrder: i }).where(eq(tasks.id, ids[i]));
  }
  return NextResponse.json({ ok: true });
}
