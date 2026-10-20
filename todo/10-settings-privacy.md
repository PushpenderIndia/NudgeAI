# PR-10 — Settings & Privacy

- **Branch:** `pr-10-settings-privacy`
- **Tier:** P1 — Core (makes "user-chosen tool access" + "privacy/control" visible)
- **Depends on:** PR-02 (settings table)
- **Goal:** Give the user real control: connection management, per-tool permission
  levels, reminder schedule, the Demo/Live toggle, data export, delete-all, and a
  clear privacy statement.

---

## Scope / tasks

### Settings page (`/settings`)
- [ ] **Connection management** — Teams, Email, GitHub, Jira: connect/disconnect, status dots (mirrors sidebar).
- [ ] **Per-tool permission toggles**: **read-only / read + draft / act-with-approval**. Persist to `settings.permissions`; the orchestrator + approval gate must respect them (e.g. read-only tool never queues an action).
- [ ] **Reminder schedule** — timesheet day/time, EOD check-in, weekly report day. Writes `reminders` (used by PR-08 scheduler).
- [ ] **Demo / Live toggle** — flips `settings.mode`; connector factory switches mock↔live.
- [ ] **Data export** — download all user data as JSON.
- [ ] **"Delete all my data"** — wipes DB tables (with strong confirm), returns to a clean state.

### Privacy statement
- [ ] Clear, plain-language panel: *data stays in the user's own local database; only the necessary text is sent to the model; nothing is sent or changed without approval.* In Australian English.

---

## Files to create
```
src/app/settings/page.tsx + components (ConnectionManager, PermissionToggle, ReminderSchedule, DataControls, PrivacyStatement)
src/app/api/settings/* (update, export, delete-all)
```

## Acceptance criteria
- [ ] Permission levels persist and are enforced (read-only tool cannot queue an outward action).
- [ ] Demo/Live toggle switches connector source.
- [ ] Export downloads JSON; delete-all clears data after confirm.
- [ ] Privacy statement is clear and accurate to how the app actually works.

## Demo relevance
Covers "user-chosen tool access" and "privacy/user control." The permission toggles + privacy statement are a quick, high-trust shot for judges.
