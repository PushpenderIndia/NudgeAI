# Nudge 🦉

> *Your work, handled. Gently.*

Nudge is a private, always-on AI office buddy. It connects to Teams, Email, GitHub and
Jira and takes over the daily admin — tracking meetings, writing minutes, drafting
replies, building your to-do list, drafting Jira comments, reminding you about
timesheets, and compiling your weekly update. **Nudge never sends or changes anything
without your approval.**

Nudge runs every AI task through **NVIDIA Nemotron** models on the
**Nebius Token Factory**.

> 🚧 Work in progress — built PR-by-PR. See [`todo/`](todo/) for the full plan.
> Full setup instructions, environment variables, architecture diagram and the
> "How we use Nemotron + Nebius Token Factory" section land in the docs PR.

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the Welcome page explains everything. Demo mode works with
no credentials; AI features need a `NEBIUS_API_KEY` (added in a later step).

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM + SQLite ·
OpenAI SDK → Nebius Token Factory · NVIDIA Nemotron.

## Licence

MIT — see [LICENSE](LICENSE).
