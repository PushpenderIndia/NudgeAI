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
      <PageHeader title="Meetings" subtitle="Today's calls — generate minutes and pull out action items in one click." />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
          <CalendarClock className="h-8 w-8 text-muted" />
          <p className="mt-3 max-w-sm text-sm text-muted">
            No meetings yet. When a meeting with a transcript lands, Nudge can turn it into
            clean minutes with decisions and action items.
          </p>
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
