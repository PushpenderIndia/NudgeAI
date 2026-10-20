import { NextResponse } from "next/server";
import { queueAction, approveAction } from "@/ai/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The user has approved a drafted Jira closing comment + transition on the Dev
 * page. Both actions go through the approval gate (queued, then approved), so
 * the connector executes them and they're logged — nothing bypasses the gate.
 */
export async function POST(req: Request) {
  const { issueKey, comment, toStatus } = await req.json();
  if (!issueKey) {
    return NextResponse.json({ error: "empty", message: "Missing ticket key." }, { status: 400 });
  }

  const results: { action: string; ok: boolean; message: string }[] = [];

  const commentAction = await queueAction({
    actionType: "post_jira_comment",
    summary: `Comment on ${issueKey}`,
    payload: { issueKey, comment },
  });
  results.push({ action: "comment", ...(await approveAction(commentAction.id)) });

  if (toStatus) {
    const transitionAction = await queueAction({
      actionType: "transition_ticket",
      summary: `Move ${issueKey} to ${toStatus}`,
      payload: { issueKey, toStatus },
    });
    results.push({ action: "transition", ...(await approveAction(transitionAction.id)) });
  }

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results });
}
