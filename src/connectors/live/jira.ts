import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

/**
 * Live Jira Cloud connector via the REST API (basic auth with email + API token).
 * Reads assigned issues; posts comments and transitions tickets (both still go
 * through Nudge's approval gate). Build-verified; needs credentials at runtime.
 */
function cfg() {
  const base = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) {
    throw new Error("Jira credentials are not set — add JIRA_BASE_URL/EMAIL/API_TOKEN or switch to Demo data.");
  }
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  return { base: base.replace(/\/+$/, ""), auth };
}

async function jira<T>(path: string, init?: RequestInit): Promise<T> {
  const { base, auth } = cfg();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Jira API ${res.status}`);
  return (res.status === 204 ? ({} as T) : ((await res.json()) as T));
}

export const jiraLiveConnector: Connector = {
  key: "jira",

  async listItems(): Promise<ConnectorItem[]> {
    const data = await jira<{ issues: Array<{ key: string; fields: Record<string, unknown> }> }>(
      "/rest/api/2/search?jql=" + encodeURIComponent("assignee=currentUser() ORDER BY updated DESC") + "&maxResults=20&fields=summary,status,assignee,updated"
    );
    const { base } = cfg();
    return data.issues.map((i) => {
      const f = i.fields;
      return {
        id: i.key,
        key: i.key,
        summary: (f.summary as string) ?? "",
        status: ((f.status as { name?: string })?.name) ?? "",
        assignee: ((f.assignee as { displayName?: string })?.displayName) ?? null,
        updatedAt: (f.updated as string) ?? new Date().toISOString(),
        url: `${base}/browse/${i.key}`,
        doneToday: false,
      };
    });
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const items = await this.listItems();
    return items.find((i) => i.key === id) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    try {
      const key = action.payload.issueKey as string;

      if (action.type === "post_jira_comment") {
        await jira(`/rest/api/2/issue/${key}/comment`, {
          method: "POST",
          body: JSON.stringify({ body: action.payload.comment }),
        });
        return { ok: true, message: `Comment posted to ${key}.` };
      }

      if (action.type === "transition_ticket") {
        const toStatus = String(action.payload.toStatus ?? "Done");
        const t = await jira<{ transitions: Array<{ id: string; name: string; to: { name: string } }> }>(
          `/rest/api/2/issue/${key}/transitions`
        );
        const match = t.transitions.find(
          (tr) => tr.name.toLowerCase() === toStatus.toLowerCase() || tr.to.name.toLowerCase() === toStatus.toLowerCase()
        );
        if (!match) return { ok: false, message: `No transition to "${toStatus}" available on ${key}.` };
        await jira(`/rest/api/2/issue/${key}/transitions`, {
          method: "POST",
          body: JSON.stringify({ transition: { id: match.id } }),
        });
        return { ok: true, message: `${key} moved to ${toStatus}.` };
      }

      return { ok: false, message: `Jira connector can't handle "${action.type}".` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Jira action failed." };
    }
  },
};
