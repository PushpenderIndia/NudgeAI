import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { getDataSource } from "@/nudge/datasource";
import { AnswerSchema, handleAnswer, loadRun } from "@/nudge/agents/answers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records the user's answer at an interaction and returns the dynamic scene data it produces. */
export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const parsed = AnswerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Unknown answer." }, { status: 400 });
  const ctx = await getRequestContext();
  const run = await loadRun(runId, ctx.sessionKey);
  if (!run) return NextResponse.json({ ok: false, message: "Run not found." }, { status: 404 });
  const { status, body } = await handleAnswer(run, parsed.data, await getDataSource(ctx));
  return NextResponse.json(body, { status });
}
