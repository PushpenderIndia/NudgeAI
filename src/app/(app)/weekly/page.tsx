import { PageHeader } from "@/components/PagePlaceholder";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";
import { db } from "@/db";
import { meetings, emails, gitActivity, jiraIssues } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const [meetingRows, emailRows, gitRows, jiraRows] = await Promise.all([
    db.select().from(meetings), db.select().from(emails), db.select().from(gitActivity), db.select().from(jiraIssues),
  ]);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day, index) => ({
    day,
    bullets: [
      meetingRows[index]?.title ? `Meeting: ${meetingRows[index].title}` : "",
      emailRows[index]?.subject ? `Email handled: ${emailRows[index].subject}` : "",
      gitRows[index]?.title ? `Delivery work: ${gitRows[index].title}` : "",
      jiraRows[index]?.summary ? `Jira: ${jiraRows[index].summary}` : "",
    ].filter(Boolean),
  }));
  return (
    <div>
      <PageHeader
        title="Weekly Update"
        subtitle="One click turns your week — meetings, email, commits and Jira — into a tidy report. Edit, then copy or export."
      />
      <WeeklyEditor daily={days} />
    </div>
  );
}
