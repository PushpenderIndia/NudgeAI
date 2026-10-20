import { db } from "@/db";
import { settings } from "@/db/schema";
import type { Connector } from "./types";
import { emailConnector } from "./mock/email";
import { jiraConnector } from "./mock/jira";
import { githubConnector } from "./mock/github";
import { teamsConnector } from "./mock/teams";

export type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "./types";

export type ConnectorKey = "email" | "jira" | "github" | "teams";

const MOCKS: Record<ConnectorKey, Connector> = {
  email: emailConnector,
  jira: jiraConnector,
  github: githubConnector,
  teams: teamsConnector,
};

/** Live connectors land in PR-11; until then "live" mode falls back to a clear error. */
function liveNotConfigured(key: ConnectorKey): Connector {
  const fail = async () => {
    throw new Error(`Live ${key} connector isn't configured yet — switch to Demo data in Settings.`);
  };
  return { key, listItems: fail, getItem: fail, performAction: fail };
}

export async function getMode(): Promise<"demo" | "live"> {
  const row = await db.select().from(settings).get();
  return row?.mode ?? "demo";
}

export async function getConnector(key: ConnectorKey): Promise<Connector> {
  const mode = await getMode();
  if (mode === "live") {
    // PR-11 will wire real implementations here.
    return liveNotConfigured(key);
  }
  return MOCKS[key];
}
