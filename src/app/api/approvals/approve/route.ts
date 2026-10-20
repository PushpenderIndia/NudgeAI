import { NextResponse } from "next/server";
import { approveAction } from "@/ai/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, ids } = await req.json();
  const list: string[] = ids ?? (id ? [id] : []);
  if (list.length === 0) {
    return NextResponse.json({ error: "empty", message: "Nothing to approve." }, { status: 400 });
  }

  const results = [];
  for (const actionId of list) {
    results.push({ id: actionId, ...(await approveAction(actionId)) });
  }

  const executed = results.filter((r) => r.ok).length;
  return NextResponse.json({ executed, results });
}
