import { NextResponse } from "next/server";
import { startWorkflow } from "@/ai/agent-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { workflow } = await req.json();
  if (!["urgent_email", "meeting_ended", "start_day"].includes(workflow)) {
    return NextResponse.json({ message: "Unknown workflow." }, { status: 400 });
  }
  return NextResponse.json(await startWorkflow(workflow));
}
