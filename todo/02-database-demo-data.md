# PR-02 — Database Schema, Seed Data, Mock Connectors

- **Branch:** `pr-02-db`
- **Tier:** P0 — Demo critical
- **Depends on:** PR-01
- **Goal:** A SQLite/Drizzle schema for every entity, a seed script that paints a
  believable workday, and mock connectors behind a common interface. After this,
  the whole app has realistic data to render — with **zero credentials except the
  Nebius key.**

---

## Scope / tasks

### Drizzle schema (`src/db/schema.ts`)
Tables (spec §7). Suggested key columns:
- [ ] `meetings` — id, title, start, end, attendees(json), transcript(text, nullable), source, hasMom(bool)
- [ ] `emails` — id, from, fromName, subject, body, received_at, triage(enum: urgent|needs_reply|fyi), is_read, source
- [ ] `drafts` — id, kind(enum: email_reply|jira_comment|weekly|mom), target_id, content(text), tone, status(draft|edited|approved|rejected), created_at
- [ ] `tasks` — id, title, due, priority(enum: today|this_week|urgent), status(todo|done), source(enum: meeting|email|jira|manual), source_id, order
- [ ] `jira_issues` — id, key, summary, status, assignee, updated_at, url
- [ ] `git_activity` — id, type(commit|pr|review), repo, title, sha/number, url, created_at
- [ ] `pending_actions` — id, action_type(send_email|post_jira_comment|transition_ticket|create_timesheet|create_task), payload(json), status(pending|approved|rejected|executed), draft_id(nullable), created_at, executed_at
- [ ] `memories` — id, type(person|project|preference|style), content, source, created_at, updated_at
- [ ] `skills` — id, name, description, enabled(bool)
- [ ] `activity_log` — id, action, summary, entity_type, entity_id, created_at
- [ ] `settings` — id/singleton, mode(demo|live), permissions(json per tool), reminder schedule(json), tone default
- [ ] `reminders` — id, kind(timesheet|eod|weekly|custom), schedule(cron/text), message, enabled
- [ ] Drizzle migration/`drizzle-kit` config + `db/index.ts` client (`DATABASE_URL=file:./nudge.db`).

### Seed script (`src/db/seed.ts`, `npm run seed`)
A believable **one workday** (align all timestamps to "today"):
- [ ] **4 meetings** — e.g. standup (with transcript), client sync (with transcript), 1:1, design review. At least 2 have transcripts so MoM has material.
- [ ] **12 emails** — including **2 urgent** (one is the hero: e.g. Priya asking for a status/deliverable with a deadline). Mix of needs-reply and FYI. Realistic names, bodies.
- [ ] **6 commits** across 1–2 repos + a couple of PRs.
- [ ] **5 Jira tickets** assigned to the user, varied statuses; at least one "done today" to drive the closing-comment flow.
- [ ] A few seed `memories` (people: "Priya = PM on Project Atlas", preferences: "prefers concise emails", style sample).
- [ ] Seed the 10 `skills` rows (enabled) and default `settings` (mode=demo) + default `reminders`.
- [ ] Idempotent: `npm run seed` resets to a clean, known demo state.

### Connector interface + mocks
- [ ] `src/connectors/types.ts` — `Connector` interface: `listItems()`, `getItem(id)`, `performAction(action)`.
- [ ] Mock implementations: `connectors/mock/{teams,email,github,jira}.ts` reading from seeded DB; `performAction` writes/flips rows (e.g. email "sent" flag) and returns success.
- [ ] `connectors/index.ts` — factory that returns mock vs live based on `settings.mode` (live stubs throw "not configured" for now; real in PR-11).

---

## Files to create
```
src/db/schema.ts, index.ts, seed.ts
drizzle.config.ts
src/connectors/types.ts, index.ts
src/connectors/mock/{teams,email,github,jira}.ts
package.json scripts: "db:push", "seed"
```

## Acceptance criteria
- [ ] `npm run db:push && npm run seed` builds `nudge.db` with the full demo day.
- [ ] Every table has realistic rows; the 2 urgent emails and the "done today" Jira ticket exist.
- [ ] Mock connectors return seeded data through the common interface; `performAction` mutates DB and logs.
- [ ] No credentials needed.

## Demo relevance
Everything the judges see is this data. The hero urgent email and the done-today Jira ticket must be crafted to tell a clean story.
