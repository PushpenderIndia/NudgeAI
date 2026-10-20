import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

export const teamsConnector: Connector = {
  key: "teams",

  async listItems(): Promise<ConnectorItem[]> {
    const rows = await db.select().from(meetings);
    return rows.map((r) => ({ ...r })) as unknown as ConnectorItem[];
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const row = await db.select().from(meetings).where(eq(meetings.id, id)).get();
    return (row as unknown as ConnectorItem) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    return { ok: false, message: `Teams connector can't handle "${action.type}".` };
  },
};
