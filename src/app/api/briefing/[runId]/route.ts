import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { getDataSource } from "@/nudge/datasource";
import { loadRun } from "@/nudge/agents/answers";
import { briefingView, ensureScript } from "@/nudge/agents/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The run, its briefing and scene script. `?fallback=1` returns a usable script right away. */
export async function GET(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const ctx = await getRequestContext();
  let run = await loadRun(runId, ctx.sessionKey);
  if (!run) return NextResponse.json({ message: "Run not found." }, { status: 404 });
  if (new URL(req.url).searchParams.get("fallback") === "1" && !run.sceneScript) {
    const profile = await getDataSource(ctx).then((ds) => ds.memory.profile()).catch(() => null);
    run = await ensureScript(run, { demo: ctx.demo, tz: profile?.timezone });
  }
  return NextResponse.json(await briefingView(run));
}
