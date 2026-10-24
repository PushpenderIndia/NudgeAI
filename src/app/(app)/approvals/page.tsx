import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions } from "@/db/schema";
import { flushDueApprovals } from "@/ai/approvals";
import { PageHeader } from "@/components/PagePlaceholder";
import { ApprovalsList, type ApprovalRow } from "@/components/approvals/ApprovalsList";
import { getRequestContext } from "@/nudge/session";

export const dynamic = "force-dynamic";

const time = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(d) : null;

export default async function ApprovalsPage() {
  await flushDueApprovals();
  const { sessionKey } = await getRequestContext();
  const rows = await db
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.sessionKey, sessionKey))
    .orderBy(desc(pendingActions.createdAt));

  const items: ApprovalRow[] = rows.map((a) => ({
    id: a.id,
    actionType: a.actionType,
    summary: a.summary,
    payload: a.payload,
    status: a.status,
    reason: a.reason,
    runId: a.runId,
    approvedVia: a.approvedVia,
    executeAfter: a.status === "approved" && a.executeAfter ? a.executeAfter.toISOString() : null,
    executedLabel: time(a.executedAt),
    createdLabel: time(a.createdAt),
  }));

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Nothing leaves Nudge without your OK. Every outward action, and what happened to it." />
      <ApprovalsList items={items} />
    </div>
  );
}
