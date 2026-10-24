/** Which live integrations are configured via env. Booleans only; never expose the values. */
export type ConnectionKey = "github" | "jira" | "calendar" | "slack";
export type ConnectionStatus = Record<ConnectionKey, boolean>;

const configured = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

export function connectionStatus(): ConnectionStatus {
  return {
    github: configured("GITHUB_TOKEN"),
    jira: configured("JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"),
    calendar: configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    slack: configured("SLACK_WEBHOOK_URL"),
  };
}
