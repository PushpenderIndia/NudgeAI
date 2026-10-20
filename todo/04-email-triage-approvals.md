# PR-04 — Email Triage + Reply Draft + Approvals Center (HERO FLOW)

- **Branch:** `pr-04-email-approvals`
- **Tier:** P0 — Demo critical (this is THE demo)
- **Depends on:** PR-03
- **Goal:** The signature flow: **urgent email arrives → Nudge triages it → drafts a
  reply → auto-creates an urgent task → user approves → action executes and is logged.**
  Build the approval gate properly here; every later outward action reuses it.

---

## Scope / tasks

### Skills
- [ ] `email-triage` (`MODEL_FAST`): classify each email → `urgent | needs_reply | fyi` + one-line reason. Writes `emails.triage`.
- [ ] `email-reply-draft` (`MODEL_HEAVY`): given an email + user tone pref + memories → drafted reply. Output `{ subject, body, tone }`. Stores `drafts` (kind=email_reply).
- [ ] `task-extractor` (`MODEL_FAST`): from an urgent email, create a task `{ title, due, priority:urgent }`.

### Approval gate (reusable core — `src/ai/approvals.ts`)
- [ ] `queueAction({ action_type, payload, draft_id? })` → writes `pending_actions` (status=pending). **Nothing outward runs here.**
- [ ] `approveAction(id)` → calls connector `performAction()`, sets status=executed, writes `activity_log`.
- [ ] `rejectAction(id)` / `editDraft(id, content)` (re-draft or manual edit → stores style preference diff into `memories`, type=style).
- [ ] Hard rule, enforced in code: send email / post Jira comment / transition ticket / create timesheet entry **only** via `approveAction`.

### Inbox page (`/inbox`)
- [ ] Triage columns/tags: **Urgent / Needs reply / FYI**.
- [ ] Selecting an email shows: original, the AI-drafted reply, and **Approve & Send / Edit / Regenerate / Reject**.
- [ ] **Urgent emails auto-create a task** with an amber badge (via `task-extractor`), shown immediately.
- [ ] **Tone setting** (formal / friendly / concise), default from memory; editing tone re-drafts.
- [ ] Edited drafts persist the diff as a style preference (memory).

### Approvals Center (`/approvals`)
- [ ] Single queue of everything awaiting OK: email replies, Jira comments, task creation, timesheet entries.
- [ ] Per item: approve / reject / edit. **Bulk approve.**
- [ ] A counter badge (feeds the Today "Approvals Needed" card in PR-05).
- [ ] On approve → executes via connector, logs to Activity Feed, removes from queue.

### Wire the chat panel (first real use)
- [ ] "Reply to Priya's email saying I'll send it by Friday" → routes to `email-reply-draft` → shows draft + approve inline.

---

## Files to create
```
src/skills/email-triage.ts, email-reply-draft.ts, task-extractor.ts
src/ai/approvals.ts
src/app/inbox/page.tsx + components (TriageColumns, EmailDetail, DraftReply)
src/app/approvals/page.tsx + ApprovalQueue
src/app/api/approvals/{queue,approve,reject}/route.ts
```

## Acceptance criteria
- [ ] Hero flow E2E: open urgent email → triaged → reply drafted → urgent task auto-created → **Approve & Send** → connector executes (mock marks sent) → logged in Activity Feed.
- [ ] No outward action fires without explicit approval (verify by rejecting — nothing sends).
- [ ] Bulk approve works.
- [ ] Editing a draft changes tone and stores a style memory.
- [ ] Friendly error if the model/connector fails.

## Demo relevance
**The centrepiece.** Rehearse this exact sequence for the video. It demonstrates: triage, drafting, memory/tone, the approval gate (privacy/control), auto-task (background), and the audit log — several track requirements in one flow.
