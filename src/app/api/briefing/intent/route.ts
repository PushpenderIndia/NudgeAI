import { NextResponse } from "next/server";
import { z } from "zod";
import { InteractionSchema } from "@/nudge/scenes";
import { parseIntent } from "@/nudge/agents/intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ transcript: z.string().max(500), interaction: InteractionSchema });

/** Spoken or typed reply → Intent (deterministic first, fast-tier model only if ambiguous). */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ intent: "unknown" });
  return NextResponse.json(await parseIntent(parsed.data.transcript, parsed.data.interaction));
}
