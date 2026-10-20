# PR-08 — Scheduler + Reminders + Notifications

- **Branch:** `pr-08-scheduler`
- **Tier:** P1 — Core (makes "background tasks" real)
- **Depends on:** PR-05
- **Goal:** The always-on part. A background worker runs the morning brief, timesheet
  and EOD reminders, and the Friday weekly report; friendly owl notifications surface
  in-app.

---

## Scope / tasks

### Scheduler (`src/scheduler/index.ts`)
- [ ] `node-cron` worker, started from a long-running server context (instrumentation hook / custom server / a `register()` in `instrumentation.ts`). Document how it starts.
- [ ] Jobs (schedules from `settings`/`reminders`, with sensible defaults):
  - [ ] **Morning brief** — generates/caches the brief for Today.
  - [ ] **Timesheet reminder** — e.g. Friday 5 PM.
  - [ ] **EOD check-in** — end-of-day nudge.
  - [ ] **Weekly report** — Friday, pre-generates the weekly update draft.
- [ ] Each job writes a `reminders`/`activity_log` entry and emits a notification.
- [ ] **Demo-friendly:** a "Run now" / "simulate time" control (dev-only) so jobs can be triggered on camera without waiting.

### Notifications (UI)
- [ ] In-app **toast** + **bell** menu driven by the owl. Friendly, not cringe:
  - *"Hoo's got a timesheet due? You do! Friday 5 PM."*
- [ ] Bell shows unread count; clicking shows recent nudges. Amber owl eyes glow when something urgent is waiting.

---

## Files to create
```
src/scheduler/index.ts, jobs/{morning-brief,timesheet,eod,weekly}.ts
src/instrumentation.ts (register scheduler)
src/components/notifications/{Bell,Toaster}.tsx
src/skills/reminder-engine.ts  (composes friendly reminder copy)
src/app/api/scheduler/run/route.ts  (dev "run now")
```

## Acceptance criteria
- [ ] Scheduler starts with the app and runs jobs on schedule.
- [ ] "Run now" triggers a job and a toast + bell entry appear.
- [ ] Reminder copy is friendly and in Australian English; owl eyes glow on urgent.
- [ ] Jobs are logged to Activity Feed.

## Demo relevance
Proves "always-on background tasks" — a judged requirement. The "Run now" control lets the video show a reminder firing without waiting for 5 PM.
