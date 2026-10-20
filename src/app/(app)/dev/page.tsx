import { desc } from "drizzle-orm";
import { db } from "@/db";
import { gitActivity, jiraIssues } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { GitDigest, type GitItemDTO } from "@/components/dev/GitDigest";
import { JiraBoard, type JiraDTO } from "@/components/dev/JiraBoard";
import { SuggestedUpdates } from "@/components/dev/SuggestedUpdates";

export const dynamic = "force-dynamic";

export default async function DevPage() {
  const git = await db.select().from(gitActivity).orderBy(desc(gitActivity.createdAt));
  const issues = await db.select().from(jiraIssues);

  const gitItems: GitItemDTO[] = git.map((g) => ({ type: g.type, repo: g.repo, title: g.title }));
  const jiraItems: JiraDTO[] = issues.map((i) => ({
    key: i.key,
    summary: i.summary,
    status: i.status,
    url: i.url,
    doneToday: i.doneToday,
  }));

  return (
    <div>
      <PageHeader
        title="Dev Activity"
        subtitle="Your GitHub and Jira work in plain language. Nudge drafts closing comments and status updates — you approve before anything posts."
      />
      <div className="space-y-6">
        <GitDigest items={gitItems} />
        <SuggestedUpdates />
        <JiraBoard issues={jiraItems} />
      </div>
    </div>
  );
}
