import { desc } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { InboxView, type EmailDTO } from "@/components/inbox/InboxView";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await db.select().from(emails).orderBy(desc(emails.receivedAt));

  const initialEmails: EmailDTO[] = rows.map((e) => ({
    id: e.id,
    fromName: e.fromName,
    fromEmail: e.fromEmail,
    subject: e.subject,
    body: e.body,
    receivedAt: e.receivedAt.toISOString(),
    triage: e.triage,
    triageReason: e.triageReason,
    isSent: e.isSent,
  }));

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Nudge sorts your email into Urgent, Needs reply and FYI — and drafts replies in your tone. You approve before anything is sent."
      />
      <InboxView initialEmails={initialEmails} />
    </div>
  );
}
