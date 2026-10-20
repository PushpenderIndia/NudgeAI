# PR-09 — Memory & Skills Page

- **Branch:** `pr-09-memory-skills`
- **Tier:** P1 — Core (makes "persistent memory" + "reusable skills" visible)
- **Depends on:** PR-03 (memory layer + skill registry already exist)
- **Goal:** Surface what Nudge remembers and the skills it can run, as editable UI.
  This is where two track requirements become tangible for judges.

---

## Scope / tasks

### Memory UI (`/memory`)
- [ ] Cards grouped by type: **People, Projects, Preferences, Writing style**.
- [ ] Each memory card is **editable** and **deletable** (with confirm).
- [ ] "Add memory" manual entry.
- [ ] Show source + last-updated so it's clear how Nudge learned it (e.g. "learned from an edited draft").
- [ ] Reflects the style memories captured in PR-04 (edited-draft diffs) — show these as "Writing style" so learning is visible.

### Skills UI (same page or tab)
- [ ] List all skills from the registry: Meeting→MoM, Email triage, Email reply, Task extractor, Jira closing comment, Jira update suggester, GitHub digest, Weekly update, Morning brief, Reminder engine.
- [ ] Each shows name + plain-language description + **toggle on/off** (persists `skills.enabled`; disabled skills are skipped by the orchestrator).

---

## Files to create
```
src/app/memory/page.tsx + components (MemoryCard, MemoryGroup, SkillToggleList)
src/app/api/memory/* (create, update, delete)
src/app/api/skills/toggle/route.ts
```

## Acceptance criteria
- [ ] Memories display grouped, editable, deletable; edits affect later prompts.
- [ ] Disabling a skill makes the orchestrator skip it (verify one).
- [ ] A writing-style memory created by editing a draft (PR-04) appears here.

## Demo relevance
Direct evidence for "persistent memory" and "reusable skills." Good shot: edit a draft → show the new style memory appear here → next draft respects it.
