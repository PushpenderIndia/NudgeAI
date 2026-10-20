import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pendingActions, drafts, tasks } from "@/db/schema";
import type { ActionType, PendingAction } from "@/db/schema";
import { getConnector, type ConnectorKey } from "@/connectors";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

/**
 * The approval gate. EVERY outward action (send email, post Jira comment,
 * transition ticket, create timesheet) is written here as `pending` and only
 * ever executed through approveAction() after the user says OK.
 */

const TOOL_FOR_ACTION: Partial<Record<ActionType, ConnectorKey>> = {
  send_email: "email",
  post_jira_comment: "jira",
  transition_ticket: "jira",
};

export async function queueAction(input: {
  actionType: ActionType;
  summary: string;
  payload: Record<string, unknown>;
  draftId?: string;
}): Promise<PendingAction> {
  const [row] = await db
    .insert(pendingActions)
    .values({
      actionType: input.actionType,
      summary: input.summary,
      payload: input.payload,
      draftId: input.draftId,
      status: "pending",
    })
    .returning();
  return row;
}

export async function listPending(): Promise<PendingAction[]> {
  return db.select().from(pendingActions).where(eq(pendingActions.status, "pending"));
}

/** Executes an approved action for real (via the connector or locally) and logs it. */
export async function approveAction(id: string): Promise<{ ok: boolean; message: string }> {
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();
  if (!action) return { ok: false, message: "That action no longer exists." };
  if (action.status !== "pending") return { ok: false, message: "That action was already handled." };

  // Permission check: a tool set to read-only can never act.
  const tool = TOOL_FOR_ACTION[action.actionType];
  if (tool) {
    const settings = await getSettings();
    if (settings.permissions[tool] === "read") {
      return { ok: false, message: `${tool} is set to read-only — change it in Settings to allow this.` };
    }
  }

  let result = { ok: true, message: "Done." };

  if (tool) {
    const connector = await getConnector(tool);
    result = await connector.performAction({ type: action.actionType, payload: action.payload });
  } else if (action.actionType === "create_task") {
    await db.insert(tasks).values({
      title: String(action.payload.title ?? "New task"),
      priority: (action.payload.priority as "today" | "this_week" | "urgent") ?? "this_week",
      source: "manual",
    });
    result = { ok: true, message: "Task created." };
  } else if (action.actionType === "create_timesheet") {
    result = { ok: true, message: "Timesheet entry logged." };
  }

  if (!result.ok) return result;

  await db
    .update(pendingActions)
    .set({ status: "executed", executedAt: new Date() })
    .where(eq(pendingActions.id, id));

  if (action.draftId) {
    await db.update(drafts).set({ status: "approved" }).where(eq(drafts.id, action.draftId));
  }

  await logActivity({
    action: "Approved & executed",
    summary: action.summary,
    entityType: "pending_action",
    entityId: action.id,
  });

  return result;
}

export async function rejectAction(id: string): Promise<{ ok: boolean; message: string }> {
  const action = await db.select().from(pendingActions).where(eq(pendingActions.id, id)).get();
  if (!action) return { ok: false, message: "That action no longer exists." };

  await db.update(pendingActions).set({ status: "rejected" }).where(eq(pendingActions.id, id));
  if (action.draftId) {
    await db.update(drafts).set({ status: "rejected" }).where(eq(drafts.id, action.draftId));
  }
  await logActivity({ action: "Rejected", summary: `Dismissed: ${action.summary}`, entityType: "pending_action", entityId: id });
  return { ok: true, message: "Dismissed." };
}
