import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(emails).orderBy(desc(emails.receivedAt));
  return NextResponse.json({ emails: rows });
}
