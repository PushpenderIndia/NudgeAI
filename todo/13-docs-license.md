# PR-13 — README, Architecture Diagram, LICENSE, FEEDBACK, .env.example, DEMO_SCRIPT

- **Branch:** `pr-13-docs`
- **Tier:** P1 — Core (required deliverables; do not skip)
- **Depends on:** all (write content as features land; finalise last)
- **Goal:** Ship the required repo artefacts. These are explicitly graded (spec §2) —
  MIT license, thorough README with a Nemotron+Nebius section and architecture diagram,
  a FEEDBACK template, `.env.example`, and a 3-minute demo script.

---

## Scope / tasks

### LICENSE
- [ ] **MIT license** at repo root, referenced at the top of the README.

### README.md (thorough)
- [ ] What Nudge is + tagline + a screenshot/gif of the hero flow.
- [ ] **Setup:** prerequisites, `npm install`, `npm run db:push`, `npm run seed`, `npm run dev`.
- [ ] **Env vars:** full table (see `.env.example`), stating **only `NEBIUS_API_KEY` is needed for the demo.**
- [ ] **How to run** (demo mode) + how to switch to live.
- [ ] **"How we use Nemotron + Nebius Token Factory"** — required section: the exact base URL, which **Nemotron** models (heavy vs fast) and why, how skills call them, structured-output + Zod validation, how memory is injected.
- [ ] **Architecture diagram** — mermaid (reuse `todo/00-OVERVIEW.md` §4), plus the approval-gate flow.
- [ ] Personal-AI track mapping: where memory / skills / tool access / privacy / background tasks each live in the UI.
- [ ] Project structure overview.

### FEEDBACK.md
- [ ] Template for Nebius/NVIDIA feedback: what worked, friction, model quality (Nemotron), API/docs experience, requests. Pre-fill with honest notes gathered during the build.

### .env.example
- [ ] Full canonical list (from `todo/00-OVERVIEW.md` §3). Real Nebius base URL + Nemotron model IDs (filled in PR-03). No real secrets.

### DEMO_SCRIPT.md (3-minute video)
- [ ] Beat-by-beat script:
  1. Welcome page — what Nudge is + "never without your OK" (15s).
  2. Today — Morning Brief, "Nudge says…", Activity Feed (20s).
  3. **Hero flow** — urgent email → triage → draft → urgent task → **approve** → logged (60s).
  4. Meeting → MoM → add to tasks (25s).
  5. Weekly update generated from everything (25s).
  6. Memory/Skills + permission toggles + privacy (background tasks reminder "run now") (25s).
  7. Close on tagline (10s).
- [ ] Note setup needed before recording (seed DB, pre-run brief, dev "run now" for reminder).

### Bonus (only if done)
- [ ] Document Nebius Serverless Endpoints deploy + Serverless Jobs for scheduled tasks.

## Acceptance criteria
- [ ] MIT LICENSE present; README covers setup/env/run + the Nemotron+Nebius section + diagram.
- [ ] FEEDBACK.md + `.env.example` present; no secrets committed.
- [ ] DEMO_SCRIPT.md gives a tight 3-minute run that matches the built app.
- [ ] `npm install` → `npm run dev` with only `NEBIUS_API_KEY` works exactly as the README says.

## Demo relevance
These are deliverables judges open directly. The README's Nemotron+Nebius section and the demo script are worth real points.
