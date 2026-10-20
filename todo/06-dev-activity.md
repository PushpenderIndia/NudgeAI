# PR-06 — Dev Activity (GitHub Digest + Jira Closing Comments & Updates)

- **Branch:** `pr-06-dev-activity`
- **Tier:** P1 — Core
- **Depends on:** PR-03 (skills + approval gate from PR-04)
- **Goal:** Turn today's commits/PRs and Jira tickets into a plain-language progress
  story, and let Nudge draft Jira closing comments + suggested status transitions —
  all behind the approval gate.

---

## Scope / tasks

### Skills
- [ ] `github-daily-digest` (`MODEL_HEAVY`): commits + PRs → plain-language "what you shipped today" summary. Output `{ summary, highlights[] }`.
- [ ] `jira-closing-comment` (`MODEL_HEAVY`): for a done ticket → `{ comment, suggestedTransition }`.
- [ ] `jira-update-suggester` (`MODEL_FAST`): map today's git work to Jira tickets → "Suggested Jira updates from today's work" `[{ issueKey, suggestion }]`.

### Dev Activity page (`/dev`)
- [ ] Today's commits & PRs → the digest summary (plain language, not raw logs).
- [ ] **Jira board-style list** of assigned tickets (grouped by status).
- [ ] For finished work: **"Draft closing comment"** → shows proposed comment + suggested status transition + **Approve** (queues a `post_jira_comment` / `transition_ticket` via the approval gate).
- [ ] **"Suggested Jira updates from today's work"** panel.

### Approval integration
- [ ] Approving a closing comment / transition routes through `approveAction` → mock Jira connector `performAction` → logs to Activity Feed. Reuses PR-04 gate; no new approval path.

---

## Files to create
```
src/skills/github-daily-digest.ts, jira-closing-comment.ts, jira-update-suggester.ts
src/app/dev/page.tsx + components (GitDigest, JiraBoard, ClosingCommentCard, SuggestedUpdates)
src/app/api/skills/{github-daily-digest,jira-closing-comment,jira-update-suggester}/route.ts
```

## Acceptance criteria
- [ ] Commits/PRs render as a readable progress summary.
- [ ] Jira tickets show board-style; a done ticket offers a drafted closing comment + transition.
- [ ] Approving queues then executes via the gate and logs it. Rejecting does nothing outward.
- [ ] "Suggested Jira updates" appears from seeded git activity.

## Demo relevance
Shows breadth (dev tools, not just email/meetings) and reinforces the approval gate on a second action type.
