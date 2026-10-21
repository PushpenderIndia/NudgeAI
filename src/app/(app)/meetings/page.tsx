import { asc, and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, agentSteps, drafts, meetingPrep, meetings } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const previousStart = new Date(dayStart); previousStart.setDate(previousStart.getDate() - 2);
  const rows = await db.select().from(meetings).where(gte(meetings.startsAt, previousStart)).orderBy(asc(meetings.startsAt));
  const prepRows = await db.select().from(meetingPrep);
  const momRows = await db.select().from(drafts).where(and(eq(drafts.kind, "mom"), eq(drafts.status, "draft")));
  const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(30);
  const steps = await db.select().from(agentSteps).orderBy(asc(agentSteps.seq));
  const dto = rows.map((m) => {
    const run = runs.find((candidate) => candidate.id === momRows.find((draft) => draft.targetId === m.id)?.runId);
    return { id: m.id, title: m.title, startsAt: m.startsAt.toISOString(), endsAt: m.endsAt.toISOString(), attendees: m.attendees, hasTranscript: Boolean(m.transcript), hasMom: m.hasMom, isToday: m.startsAt >= dayStart, prep: prepRows.find((p) => p.meetingId === m.id) ?? null, run: run ? { id: run.id, title: run.title, status: run.status, startedAt: run.startedAt?.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null, steps: steps.filter((s) => s.runId === run.id).map((s) => ({ id: s.id, agent: s.agent, action: s.action, tool: s.tool, model: s.model, inputSummary: s.inputSummary, outputSummary: s.outputSummary, handoffTo: s.handoffTo, status: s.status, startedAt: s.startedAt?.toISOString(), finishedAt: s.finishedAt?.toISOString() ?? null })) } : null };
  });
  const today = dto.filter((m) => m.isToday);
  const previous = dto.filter((m) => !m.isToday);

  return (
    <div>
      <PageHeader title="Meetings" subtitle="Notes and action items from your calls." />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-y border-border px-6 py-16 text-center">
          <CalendarClock className="h-8 w-8 text-muted" />
          <p className="mt-3 max-w-sm text-sm text-muted">No meetings today. Your calendar is clear.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section><h2 className="mb-3 text-base font-semibold">Today’s meetings</h2><div className="space-y-3">{today.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={{
                id: m.id,
                title: m.title,
                startsAt: m.startsAt,
                endsAt: m.endsAt,
                attendees: m.attendees,
                hasTranscript: m.hasTranscript,
                hasMom: m.hasMom, isToday: true, prep: m.prep, run: m.run,
              }}
            />
          ))}</div></section>
          <details><summary className="cursor-pointer border-b border-border pb-3 text-base font-semibold">Previous meetings · last 2 days ({previous.length})</summary><div className="mt-4 space-y-3">{previous.map((m) => <MeetingCard key={m.id} meeting={{ ...m, isToday: false, prep: null, run: m.run }} />)}</div></details>
        </div>
      )}
    </div>
  );
}
