# PR-05 — Today Dashboard + Morning Brief + Tasks

- **Branch:** `pr-05-today-tasks`
- **Tier:** P0 — Demo critical
- **Depends on:** PR-04
- **Goal:** The home that ties the day together: an AI Morning Brief, meetings timeline,
  prioritised tasks, approvals counter, the amber "Nudge says…" callout, and a visible
  "What Nudge did today" activity feed. Plus the unified Tasks page.

---

## Scope / tasks

### Skill
- [ ] `morning-brief` (`MODEL_HEAVY`): summarise today from meetings + emails + Jira + git into a short, warm brief. Output `{ brief, topPriority }`. Cached per day; regenerate button.

### Today page (`/today` — also the "Try with demo data" landing)
- [ ] Greeting with the owl ("Good morning, Pushpender").
- [ ] **Morning Brief** card (AI-written).
- [ ] **Today's meetings timeline** (from seeded meetings; link to MoM).
- [ ] **Prioritised task list** (top items; links to Tasks page).
- [ ] **Approvals Needed** counter (from `pending_actions` pending count → links to Approvals Center).
- [ ] **"Nudge says…"** amber callout = the single most important thing right now (`topPriority`).
- [ ] **Activity Feed** — "What Nudge did today" from `activity_log` (e.g. "Drafted 3 replies, created 2 tasks, summarised 1 meeting"). This is the visible proof of background work.

### Tasks page (`/tasks`)
- [ ] Unified to-do list from meetings + emails + Jira + manual, each with a **source badge** (color-coded).
- [ ] Filters: **Today / This week / Urgent**.
- [ ] Drag to reorder (persist `order`); click to mark done.
- [ ] Quick "add task" manual entry.
- [ ] Urgent tasks carry the amber badge.

---

## Files to create
```
src/skills/morning-brief.ts
src/app/today/page.tsx + components (MorningBrief, MeetingsTimeline, PriorityTasks, ApprovalsCounter, NudgeSays, ActivityFeed)
src/app/tasks/page.tsx + components (TaskList, SourceBadge, TaskFilters)
src/app/api/skills/morning-brief/route.ts
src/app/api/tasks/* (reorder, toggle, create)
```

## Acceptance criteria
- [ ] Today page loads a real AI Morning Brief from seeded data.
- [ ] Approvals counter reflects actual pending actions; "Nudge says…" shows the top priority in amber.
- [ ] Activity Feed shows real logged actions (created by PR-03/04 flows).
- [ ] Tasks page aggregates all sources with correct badges; filters + drag-reorder + done work.
- [ ] A first-time viewer understands the day within 10 seconds.

## Demo relevance
The "home base" shot — judges should feel the whole day is handled. The Activity Feed is where "background tasks" becomes visible.
