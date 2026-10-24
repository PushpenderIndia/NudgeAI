import { NextResponse } from "next/server";
import { getRequestContext } from "@/nudge/session";
import { getDemoState } from "@/nudge/datasource";
import { flushDueApprovals } from "@/ai/approvals";
import { DEMO_STANDUP_CHANNEL } from "@demo/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Sandbox drawer's view of this session's fake Jira, Slack and Outbox. */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx.demo) return NextResponse.json({ error: "not_demo", message: "Not in demo mode." }, { status: 400 });
  await flushDueApprovals();
  const state = await getDemoState(ctx.sessionKey);
  return NextResponse.json({
    tickets: state.tickets,
    slack: state.slack.filter((m) => m.channel === DEMO_STANDUP_CHANNEL),
    outbox: state.outbox,
  });
}
