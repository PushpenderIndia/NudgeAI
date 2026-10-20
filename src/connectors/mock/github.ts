import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gitActivity } from "@/db/schema";
import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

export const githubConnector: Connector = {
  key: "github",

  async listItems(): Promise<ConnectorItem[]> {
    const rows = await db.select().from(gitActivity);
    return rows.map((r) => ({ ...r })) as unknown as ConnectorItem[];
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const row = await db.select().from(gitActivity).where(eq(gitActivity.id, id)).get();
    return (row as unknown as ConnectorItem) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    // GitHub is read-only in the demo.
    return { ok: false, message: `GitHub is read-only in demo mode ("${action.type}").` };
  },
};
