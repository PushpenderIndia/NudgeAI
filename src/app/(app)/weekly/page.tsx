import { PageHeader } from "@/components/PagePlaceholder";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";

export const dynamic = "force-dynamic";

export default function WeeklyPage() {
  return (
    <div>
      <PageHeader
        title="Weekly Update"
        subtitle="One click turns your week — meetings, email, commits and Jira — into a tidy report. Edit, then copy or export."
      />
      <WeeklyEditor />
    </div>
  );
}
