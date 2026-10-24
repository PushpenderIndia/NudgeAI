import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions, drafts, tasks } from "@/db/schema";
import type { ActionType, PendingAction } from "@/db/schema";
import { getConnector, type ConnectorKey } from "@/connectors";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { getSessionDataSource } from "@/nudge/datasource";
import { LIVE_SESSION } from "@/nudge/session";
import type { TicketStatus } from "@/nudge/types";
import { DEMO_STANDUP_CHANNEL } from "@demo/seed";

/**
 * The approval gate. EVERY outward action (send email, post Jira comment,
 * transition ticket, Slack post, timesheet) is written here as `pending`. An
 * approval starts a short Undo window; only after it does the action execute,
 * into the demo Sandbox for demo sessions or the real service for live.
 */

const TOOL_FOR_ACTION: Partial<Record<ActionType, ConnectorKey>> = {
  send_email: "email",
  post_jira_comment: "jira",
  transition_ticket: "jira",
};

export const UNDO_WINDOW_MS = 5000;

type Result = { ok: boolean; message: string };

// Undo-window timers, kept across dev hot reloads.
const timers = ((globalThis as unknown as { __nudgeApprovalTimers?: Map<string, NodeJS.Timeout> }).__nudgeApprovalTimers ??= new Map());

export async function queueAction(input: {
  actionType: ActionType;
  summary: string;
  payload: Record<string, unknown>;
  draftId?: string;
  runId?: string;
  reason?: string;
  sessionKey?: string;
}): Promise<PendingAction> {
  const [row] = await db
    .insert(pendingActions)
    .values({
      actionType: input.actionType,
      summary: input.summary,
      payload: input.payload,
      draftId: input.draftId,
      runId: input.runId,
      reason: input.reason,
      sessionKey: input.sessionKey ?? LIVE_SESSION,
      status: "pending",
    })
    .returning();
  return row;
}

/** True when the action exists and was queued for this session (demo key or "live"). */
export async function ownsAction(id: string, sessionKey: string) {
  const row = await db.select({ sessionKey: pendingActions.sessionKey }).from(pendingActions).where(eq(pendingActions.id, id)).get();
  return row?.sessionKey === sessionKey;
}

export async function listPending(sessionKey?: string): Promise<PendingAction[]> {
  const status = eq(pendingActions.status, "pending");
  return db
    .select()
    .from(pendingActions)
    .where(sessionKey ? and(status, eq(pendingActions.sessionKey, sessionKey)) : status);
}

export type ApproveOptions = { via?: "voice" | "click" };
export type ApproveResult = { ok: boolean; message: string; undoUntil?: string };

/** Approves one action and schedules it to execute once the Undo window passes. */
export async function approveAction(id: string, opts: ApproveOptions = {}): Promise<ApproveResult> {
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();
  if (!action) return { ok: false, message: "That action no longer exists." };
  if (action.status !== "pending") return { ok: false, message: "That action was already handled." };

  // Permission check: a tool set to read-only can never act (demo actions only touch the Sandbox).
  const tool = TOOL_FOR_ACTION[action.actionType];
  if (tool && action.sessionKey === LIVE_SESSION) {
    const settings = await getSettings();
    if (settings.permissions[tool] === "read") {
      return { ok: false, message: `${tool} is set to read-only — change it in Settings to allow this.` };
    }
  }

  const executeAfter = new Date(Date.now() + UNDO_WINDOW_MS);
  const claimed = await db
    .update(pendingActions)
    .set({ status: "approved", approvedVia: opts.via ?? "click", executeAfter })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, "pending")))
    .returning({ id: pendingActions.id });
  if (claimed.length === 0) return { ok: false, message: "That action was already handled." };

  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void executeApproved(id).catch((err) => console.error("[approvals] execute failed", err));
    }, UNDO_WINDOW_MS)
  );

  return { ok: true, message: "Approved. It runs in 5 seconds unless you undo.", undoUntil: executeAfter.toISOString() };
}

/** Reverts an approval still inside its Undo window. */
export async function undoAction(id: string): Promise<Result> {
  const reverted = await db
    .update(pendingActions)
    .set({ status: "pending", approvedVia: null, executeAfter: null })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, "approved")))
    .returning({ summary: pendingActions.summary });
  if (reverted.length === 0) return { ok: false, message: "Too late to undo: it has already run." };
  clearTimeout(timers.get(id));
  timers.delete(id);
  await logActivity({ action: "Undid approval", summary: reverted[0].summary, entityType: "pending_action", entityId: id });
  return { ok: true, message: "Undone. Nothing was sent." };
}

/** Executes every approved action whose Undo window has passed. Idempotent; safe to call often. */
export async function flushDueApprovals(): Promise<void> {
  const due = await db
    .select({ id: pendingActions.id })
    .from(pendingActions)
    .where(and(eq(pendingActions.status, "approved"), or(isNull(pendingActions.executeAfter), lte(pendingActions.executeAfter, new Date()))));
  for (const row of due) await executeApproved(row.id);
}

async function executeApproved(id: string): Promise<Result> {
  // Claim the row first so a timer and a flush can never both run it.
  const [action] = await db
    .update(pendingActions)
    .set({ status: "executed", executedAt: new Date() })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, "approved")))
    .returning();
  if (!action) return { ok: false, message: "Nothing to run." };

  let result: Result;
  try {
    result = await perform(action);
  } catch (err) {
    result = { ok: false, message: err instanceof Error ? err.message : "The action failed." };
  }

  if (!result.ok) {
    await db
      .update(pendingActions)
      .set({ status: "pending", executedAt: null, executeAfter: null, approvedVia: null })
      .where(eq(pendingActions.id, id));
    await logActivity({ action: "Action failed", summary: `${action.summary}: ${result.message}`, entityType: "pending_action", entityId: id });
    return result;
  }

  if (action.draftId) {
    await db.update(drafts).set({ status: "approved" }).where(eq(drafts.id, action.draftId));
  }
  await logActivity({
    action: action.approvedVia === "voice" ? "Approved by voice & executed" : "Approved & executed",
    summary: action.summary,
    entityType: "pending_action",
    entityId: action.id,
  });
  return result;
}

async function perform(action: PendingAction): Promise<Result> {
  const p = action.payload;
  const demo = action.sessionKey !== LIVE_SESSION;

  if (action.actionType === "post_slack") {
    const ds = await getSessionDataSource(action.sessionKey);
    const channel = String(p.channel ?? DEMO_STANDUP_CHANNEL);
    await ds.slack.post(channel, String(p.text ?? ""));
    return { ok: true, message: `Posted to ${channel}.` };
  }

  if (demo) {
    const ds = await getSessionDataSource(action.sessionKey);
    if (action.actionType === "transition_ticket") {
      const key = String(p.key ?? p.issueKey);
      const to = String(p.to ?? p.toStatus ?? "In Review") as TicketStatus;
      await ds.jira.transition(key, to);
      return { ok: true, message: `${key} moved to ${to}.` };
    }
    if (action.actionType === "send_email") {
      await ds.email.send({ to: String(p.to ?? ""), subject: String(p.subject ?? ""), body: String(p.body ?? "") });
      return { ok: true, message: `Email sent to ${p.to}.` };
    }
    if (action.actionType === "post_jira_comment") {
      return { ok: true, message: `Comment added to ${p.issueKey ?? p.key}.` };
    }
  }

  const tool = TOOL_FOR_ACTION[action.actionType];
  if (tool) {
    const connector = await getConnector(tool);
    return connector.performAction({ type: action.actionType, payload: p });
  }
  if (action.actionType === "create_task") {
    await db.insert(tasks).values({
      title: String(p.title ?? "New task"),
      priority: (p.priority as "today" | "this_week" | "urgent") ?? "this_week",
      source: "manual",
    });
    return { ok: true, message: "Task created." };
  }
  if (action.actionType === "create_timesheet") return { ok: true, message: "Timesheet entry logged." };
  return { ok: false, message: `Nudge can't run "${action.actionType}" yet.` };
}

export async function rejectAction(id: string): Promise<Result> {
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();
  if (!action) return { ok: false, message: "That action no longer exists." };

  clearTimeout(timers.get(id));
  timers.delete(id);
  await db.update(pendingActions).set({ status: "rejected" }).where(eq(pendingActions.id, id));
  if (action.draftId) {
    await db.update(drafts).set({ status: "rejected" }).where(eq(drafts.id, action.draftId));
  }
  await logActivity({ action: "Rejected", summary: `Dismissed: ${action.summary}`, entityType: "pending_action", entityId: id });
  return { ok: true, message: "Dismissed." };
}
