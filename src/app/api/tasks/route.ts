import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { TaskPriority } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(tasks).orderBy(asc(tasks.sortOrder));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const { title, priority, due } = await req.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "empty", message: "A task needs a title." }, { status: 400 });
  }
  const [row] = await db
    .insert(tasks)
    .values({
      title,
      priority: (priority as TaskPriority) ?? "this_week",
      source: "manual",
      due: due ? new Date(due) : null,
      sortOrder: Date.now(),
    })
    .returning();
  return NextResponse.json({ task: row });
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Missing task id." }, { status: 400 });
  await db.update(tasks).set({ status: status === "done" ? "done" : "todo" }).where(eq(tasks.id, id));
  return NextResponse.json({ ok: true });
}
