import { NextResponse } from "next/server";
import { approveAction } from "@/ai/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Approves one or more actions; each runs after a 5 s Undo window (see /api/approvals/undo). */
export async function POST(req: Request) {
  const { id, ids, via } = (await req.json()) as { id?: string; ids?: string[]; via?: "voice" | "click" };
  const list: string[] = ids ?? (id ? [id] : []);
  if (list.length === 0) {
    return NextResponse.json({ error: "empty", message: "Nothing to approve." }, { status: 400 });
  }

  const results = [];
  for (const actionId of list) {
    results.push({ id: actionId, ...(await approveAction(actionId, { via: via === "voice" ? "voice" : "click" })) });
  }

  const executed = results.filter((r) => r.ok).length;
  return NextResponse.json({ executed, results });
}
