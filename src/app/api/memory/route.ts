import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import type { MemoryType } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(memories).orderBy(asc(memories.type));
  return NextResponse.json({ memories: rows });
}

export async function POST(req: Request) {
  const { type, content } = await req.json();
  if (!type || !content) {
    return NextResponse.json({ error: "empty", message: "A memory needs a type and content." }, { status: 400 });
  }
  const [memory] = await db
    .insert(memories)
    .values({ type: type as MemoryType, content, source: "user" })
    .returning();
  return NextResponse.json({ memory });
}

export async function PATCH(req: Request) {
  const { id, content } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Missing id." }, { status: 400 });
  await db.update(memories).set({ content, updatedAt: new Date() }).where(eq(memories.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Missing id." }, { status: 400 });
  await db.delete(memories).where(eq(memories.id, id));
  return NextResponse.json({ ok: true });
}
