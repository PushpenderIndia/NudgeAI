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
npm run setup
npm run dev
```

`npm run setup` creates the local SQLite tables and loads the demo data. The `dev` script
also checks and applies the Drizzle schema automatically before starting Next.js.

Open http://localhost:3000 — the login page uses the demo credentials shown on screen.
Demo mode works with no credentials; AI features need a `NEBIUS_API_KEY`.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM + SQLite ·
OpenAI SDK → Nebius Token Factory · NVIDIA Nemotron.

## Licence

MIT — see [LICENSE](LICENSE).
