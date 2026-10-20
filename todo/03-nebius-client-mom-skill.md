# PR-03 — Nebius Token Factory Client + Meeting→MoM Skill (first E2E)

- **Branch:** `pr-03-nebius-mom`
- **Tier:** P0 — Demo critical
- **Depends on:** PR-02
- **Goal:** Prove the AI spine works. Build the Nebius client, the skill framework, the
  memory layer, and the **first real skill end to end**: a meeting transcript →
  structured Minutes of Meeting, verified with a real Nemotron call.

---

## ⚠️ Do this first
- [ ] **Read the current Nebius Token Factory docs** for the correct OpenAI-compatible
  **base URL** and the exact **Nemotron model IDs** (heavy + fast). Do not guess.
  Record them in `.env.example` and the README's "How we use Nemotron + Nebius" section.

---

## Scope / tasks

### Nebius client (`src/ai/client.ts`)
- [ ] OpenAI SDK configured with `baseURL = NEBIUS_BASE_URL`, `apiKey = NEBIUS_API_KEY`.
- [ ] Helpers: `chat({ model, messages, tools?, stream? })`, model selection via `MODEL_HEAVY` / `MODEL_FAST`.
- [ ] `completeJSON(schema, ...)` — calls model, parses, validates with Zod, **retries once** on invalid JSON, throws friendly error after.
- [ ] Graceful failure: wrap errors so UI can show "Nudge couldn't reach its brain just now." (no stack traces, no secrets).

### Skill framework (`src/skills/`)
- [ ] `src/skills/types.ts` — a `Skill` = `{ name, description, systemPrompt, allowedTools, outputSchema (Zod), model: 'heavy'|'fast' }`.
- [ ] `src/skills/registry.ts` — register all skills; respects `skills.enabled` flag from DB.
- [ ] Orchestrator core (`src/ai/orchestrator.ts`): `runSkill(name, input)` → assembles system prompt + retrieved memories + input → tool-calling loop → validated JSON out. (Full event routing grows in later PRs; start with direct invocation.)

### Memory layer (`src/ai/memory.ts`)
- [ ] `getRelevantMemories(query/context)` — keyword retrieval over `memories` (simple; embeddings optional later). Inject into system prompt.
- [ ] `saveMemory({ type, content, source })`, `updateMemory`, `deleteMemory`.
- [ ] Used by every skill from here on.

### First skill: `meeting-to-mom`
- [ ] System prompt: produce MoM from a transcript. Output schema: `{ summary, decisions[], discussionPoints[], actionItems: [{ title, owner, due }] }`.
- [ ] Uses `MODEL_HEAVY`.
- [ ] Server action / route: `POST /api/skills/meeting-to-mom` (meetingId) → runs skill → stores a `drafts` row (kind=mom) → returns structured MoM.
- [ ] Action items can be pushed to `tasks` (source=meeting) — "Add all to tasks" (UI wired in PR-03 or PR-05; API ready here).

### Meetings page (`/meetings`)
- [ ] List + timeline of seeded meetings.
- [ ] Each has **"Generate MoM"** → shows "Nudge is thinking…" (animated owl) → renders MoM: summary, decisions, discussion points, action items (owner, due).
- [ ] **"Add all to tasks"** and **"Copy / Export as Markdown"**.

---

## Files to create
```
src/ai/client.ts, orchestrator.ts, memory.ts
src/skills/types.ts, registry.ts, meeting-to-mom.ts
src/app/api/skills/meeting-to-mom/route.ts
src/app/meetings/page.tsx + components
```

## Acceptance criteria
- [ ] A real Nemotron call on Token Factory returns a valid, Zod-validated MoM from a seeded transcript.
- [ ] Invalid-JSON path retries once then fails gracefully.
- [ ] Meeting → MoM → action items → "Add all to tasks" creates `tasks` rows.
- [ ] Memories are retrieved and visibly influence output (e.g. correct owner names).
- [ ] `.env.example` + README have the real base URL + Nemotron model IDs.

## Demo relevance
Second demo beat: "Nudge turns a meeting into minutes and tasks." Also the moment judges see a real Nemotron call doing reasoning.
