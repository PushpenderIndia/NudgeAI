import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";
import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

export const emailConnector: Connector = {
  key: "email",

  async listItems(): Promise<ConnectorItem[]> {
    const rows = await db.select().from(emails);
    return rows.map((r) => ({ ...r })) as unknown as ConnectorItem[];
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const row = await db.select().from(emails).where(eq(emails.id, id)).get();
    return (row as unknown as ConnectorItem) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    if (action.type === "send_email") {
      const emailId = action.payload.emailId as string | undefined;
      if (emailId) {
        await db.update(emails).set({ isSent: true, isRead: true }).where(eq(emails.id, emailId));
      }
      const to = (action.payload.to as string) ?? "the recipient";
      return { ok: true, message: `Reply sent to ${to}.` };
    }
    return { ok: false, message: `Email connector can't handle "${action.type}".` };
  },
};
