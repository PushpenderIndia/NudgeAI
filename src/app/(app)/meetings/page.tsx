import { asc } from "drizzle-orm";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const rows = await db.select().from(meetings).orderBy(asc(meetings.startsAt));

  return (
    <div>
      <PageHeader title="Meetings" subtitle="Notes and action items from your calls." />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
          <CalendarClock className="h-8 w-8 text-muted" />
          <p className="mt-3 max-w-sm text-sm text-muted">No meetings today. Your calendar is clear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={{
                id: m.id,
                title: m.title,
                startsAt: m.startsAt.toISOString(),
                endsAt: m.endsAt.toISOString(),
                attendees: m.attendees,
                hasTranscript: Boolean(m.transcript),
                hasMom: m.hasMom,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
