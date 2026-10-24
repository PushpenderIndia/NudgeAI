import { NextResponse } from "next/server";
import { undoAction } from "@/ai/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "empty", message: "Nothing to undo." }, { status: 400 });
  return NextResponse.json(await undoAction(id));
}
