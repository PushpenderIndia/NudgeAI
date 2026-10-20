import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jiraIssues } from "@/db/schema";
import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

export const jiraConnector: Connector = {
  key: "jira",

  async listItems(): Promise<ConnectorItem[]> {
    const rows = await db.select().from(jiraIssues);
    return rows.map((r) => ({ ...r })) as unknown as ConnectorItem[];
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const row = await db.select().from(jiraIssues).where(eq(jiraIssues.id, id)).get();
    return (row as unknown as ConnectorItem) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    const issueKey = action.payload.issueKey as string | undefined;

    if (action.type === "post_jira_comment") {
      return { ok: true, message: `Comment posted to ${issueKey ?? "the ticket"}.` };
    }

    if (action.type === "transition_ticket") {
      const toStatus = (action.payload.toStatus as string) ?? "Done";
      if (issueKey) {
        await db.update(jiraIssues).set({ status: toStatus, updatedAt: new Date() }).where(eq(jiraIssues.key, issueKey));
      }
      return { ok: true, message: `${issueKey ?? "Ticket"} moved to ${toStatus}.` };
    }

    return { ok: false, message: `Jira connector can't handle "${action.type}".` };
  },
};
