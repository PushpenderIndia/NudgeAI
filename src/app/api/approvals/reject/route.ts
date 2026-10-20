import { NextResponse } from "next/server";
import { rejectAction } from "@/ai/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Nothing to reject." }, { status: 400 });
  const result = await rejectAction(id);
  return NextResponse.json(result);
}
