# PR-07 — Weekly Update Generator + Export

- **Branch:** `pr-07-weekly-update`
- **Tier:** P1 — Core
- **Depends on:** PR-05, PR-06 (needs tasks + dev activity as sources)
- **Goal:** One click compiles the week's meetings, emails, commits, and Jira activity
  into an editable weekly update with sections, regenerate-per-section, and export.

---

## Scope / tasks

### Skill
- [ ] `weekly-update` (`MODEL_HEAVY`): combine the week's sources → `{ highlights[], progress[], blockers[], nextWeek[] }`. Pull from meetings, emails, git_activity, jira_issues, tasks.
- [ ] Support **"Regenerate section"** — regenerate a single section without touching the others.

### Weekly Update page (`/weekly`)
- [ ] **One-click generate** from combined sources ("Nudge is thinking…" owl state).
- [ ] Editable rich-text draft with sections: **Highlights, Progress, Blockers, Next week**.
- [ ] Per-section **Regenerate**, **Copy**.
- [ ] **Export .md** (and **.docx** if time — use a lightweight md→docx; .md is the must-have).
- [ ] Store as a `drafts` row (kind=weekly) so it persists.

---

## Files to create
```
src/skills/weekly-update.ts
src/app/weekly/page.tsx + components (WeeklyEditor, SectionBlock, ExportMenu)
src/app/api/skills/weekly-update/route.ts
src/lib/export/{markdown,docx}.ts
```

## Acceptance criteria
- [ ] Generates a coherent weekly update drawing from all four sources.
- [ ] Each section editable; "Regenerate section" replaces only that section.
- [ ] Copy + Export .md work; .docx if time allowed.

## Demo relevance
A strong closing beat: "and on Friday, Nudge writes your weekly update from everything that happened." High-value, visibly combines all data sources.
