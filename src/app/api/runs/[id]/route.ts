import { getRequestContext } from "@/nudge/session";
import { getRunDetail } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One run with its steps, saved scene script and answers (RunDetail). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { sessionKey } = await getRequestContext();
  const run = await getRunDetail(id, sessionKey);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json(run, { headers: { "Cache-Control": "no-store" } });
}
