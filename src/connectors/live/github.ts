import type { Connector, ConnectorAction, ActionResult, ConnectorItem } from "../types";

/**
 * Live GitHub connector (read-only) via the REST API using GITHUB_TOKEN.
 * Build-verified; needs a token to exercise at runtime.
 */
const API = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set — add it to .env or switch to Demo data.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Nudge",
  };
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json() as Promise<T>;
}

export const githubLiveConnector: Connector = {
  key: "github",

  async listItems(): Promise<ConnectorItem[]> {
    const me = await gh<{ login: string }>("/user");
    const events = await gh<Array<Record<string, unknown>>>(`/users/${me.login}/events?per_page=30`);
    const items: ConnectorItem[] = [];
    for (const ev of events) {
      const type = ev.type as string;
      const repo = (ev.repo as { name?: string })?.name ?? "";
      const createdAt = (ev.created_at as string) ?? new Date().toISOString();
      const payload = ev.payload as Record<string, unknown>;
      if (type === "PushEvent") {
        for (const c of (payload.commits as Array<{ sha: string; message: string }>) ?? []) {
          items.push({
            id: c.sha,
            type: "commit",
            repo,
            title: c.message,
            ref: c.sha.slice(0, 7),
            url: `https://github.com/${repo}/commit/${c.sha}`,
            createdAt,
          });
        }
      } else if (type === "PullRequestEvent") {
        const pr = payload.pull_request as { number: number; title: string; html_url: string };
        if (pr) {
          items.push({ id: String(pr.number), type: "pr", repo, title: pr.title, ref: String(pr.number), url: pr.html_url, createdAt });
        }
      }
    }
    return items;
  },

  async getItem(id: string): Promise<ConnectorItem | null> {
    const items = await this.listItems();
    return items.find((i) => i.id === id) ?? null;
  },

  async performAction(action: ConnectorAction): Promise<ActionResult> {
    return { ok: false, message: `GitHub is read-only in Nudge ("${action.type}").` };
  },
};
