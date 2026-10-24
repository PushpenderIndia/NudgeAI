import { NextResponse } from "next/server";
import { rejectAction, ownsAction } from "@/ai/approvals";
import { getRequestContext } from "@/nudge/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "empty", message: "Nothing to reject." }, { status: 400 });
  if (!(await ownsAction(id, (await getRequestContext()).sessionKey))) {
    return NextResponse.json({ ok: false, message: "That action no longer exists." }, { status: 404 });
  }
  const result = await rejectAction(id);
  return NextResponse.json(result);
}
