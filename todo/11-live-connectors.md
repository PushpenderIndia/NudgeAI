# PR-11 — Live Connectors

- **Branch:** `pr-11-live-connectors`
- **Tier:** P2 — Stretch (only if MVP is solid)
- **Depends on:** PR-06, PR-04 (skills + gate), PR-10 (Demo/Live toggle + permissions)
- **Goal:** Replace mocks with real integrations behind the same `Connector` interface,
  in order of effort: **GitHub + Jira first, then Email, then Teams.** The app must keep
  working in demo mode throughout — live is purely additive.

---

## Scope / tasks

> Build each connector to the existing `Connector` interface (`listItems`, `getItem`,
> `performAction`). No skill or UI changes should be needed — only the connector impl.

### GitHub (Octokit)
- [ ] Auth via `GITHUB_TOKEN`. `listItems` → commits/PRs/reviews; `getItem`; `performAction` (e.g. PR comment) if used.

### Jira (Jira Cloud REST)
- [ ] Auth via `JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN`. `listItems` → assigned issues; `performAction` → post comment, transition ticket (still gated by approval).

### Email (Microsoft Graph Mail or Gmail)
- [ ] Read messages, create drafts, send. Send **only** via `approveAction`.

### Teams / Calendar (Microsoft Graph)
- [ ] Calendar events + online meeting transcripts. (Consider an MCP server if one is available.)

### Cross-cutting
- [ ] OAuth/token handling documented; secrets only from env, never committed.
- [ ] Connector factory (PR-02) returns live impls when `settings.mode = live` and the tool's permission allows it.
- [ ] Graceful fallback to a friendly error if a live call fails; demo mode unaffected.

---

## Files to touch
```
src/connectors/live/{github,jira,email,teams}.ts
src/connectors/index.ts (factory: wire live impls)
.env.example (live vars already listed in PR-13)
```

## Acceptance criteria
- [ ] With live creds + Live mode, GitHub and Jira read real data; a gated Jira action executes on approval.
- [ ] Email/Teams live if time permits.
- [ ] Demo mode continues to work with zero credentials.
- [ ] No secrets committed.

## Demo relevance
Optional. Mention in the README/demo as "ready for live via the same interface" even if only GitHub/Jira are wired. Don't risk the core demo for this.
