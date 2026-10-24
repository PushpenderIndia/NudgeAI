"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/nudge/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SideRunResult } from "./SideRunResult";
import { Section, hhmm } from "./ui";

/** Today's calendar, each upcoming meeting with a "Prep me for HH:MM" run. */
export function Meetings({
  events,
  active = false,
  prepRuns,
  onPrep,
  onOpenRun,
}: {
  events: CalendarEvent[];
  active?: boolean;
  /** eventId → the meeting_prep run started for it. */
  prepRuns: Record<string, string>;
  onPrep: (eventId: string) => void;
  onOpenRun: (runId: string) => void;
}) {
  const [now] = useState(() => Date.now());
  return (
    <Section title="Today's meetings" active={active}>
      {events.length === 0 ? (
        <p className="text-xs text-muted">No meetings today.</p>
      ) : (
        <ul className="-my-1 divide-y divide-border">
          {events.map((e) => {
            const past = new Date(e.end).getTime() < now;
            const runId = prepRuns[e.id];
            return (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className={cn("w-24 shrink-0 text-xs tabular-nums", past ? "text-muted/60" : "text-muted")}>
                    {hhmm(e.start)}–{hhmm(e.end)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", past ? "text-muted" : "font-medium")}>{e.title}</p>
                    {e.attendees.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">{e.attendees.join(", ")}</p>}
                  </div>
                  {!past && !runId && (
                    <Button size="sm" variant="secondary" onClick={() => onPrep(e.id)}>
                      Prep me for {hhmm(e.start)}
                    </Button>
                  )}
                </div>
                {runId && <SideRunResult runId={runId} onOpen={() => onOpenRun(runId)} className="mt-3 sm:ml-28" />}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
