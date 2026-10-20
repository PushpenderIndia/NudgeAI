# PR-01 — Scaffold, Design System, Owl Logo, Layout, Welcome

- **Branch:** `pr-01-scaffold`
- **Tier:** P0 — Demo critical
- **Depends on:** nothing
- **Goal:** A running Next.js app that *looks like Nudge* — deep-navy theme, owl logo,
  sidebar + right chat panel shell, and a self-explanatory Welcome page. This is the
  first 10-second impression; it must already feel premium.

---

## Scope / tasks

### Project setup
- [ ] `create-next-app` (App Router, TypeScript, Tailwind, ESLint, `src/` dir).
- [ ] Add shadcn/ui, lucide-react, framer-motion.
- [ ] `.gitignore` covers `.env`, `nudge.db`, `node_modules`, `.next`.
- [ ] `.env.example` stub (full list lives in PR-13; at least `NEBIUS_API_KEY`).
- [ ] Font: Inter or Plus Jakarta Sans via `next/font`.

### Design tokens (the whole app depends on these — get them exactly right)
- [ ] Define CSS variables in `globals.css` and map to Tailwind theme tokens:
  - `--bg` #0A0F25, `--surface` #121936, `--surface-2` #1A2250, `--border` #2A3370
  - `--primary` #6D5BF6, `--primary-soft` #A79BFF, `--indigo` #4C5BD4
  - `--text` #EEF0FF, `--muted` #8E96C9
  - `--nudge` #FBBF24 (amber — **only** owl eyes, urgent items, "Nudge says…" callouts)
  - `--success` #34D399, `--danger` #F87171
- [ ] Dark mode by default. Rounded-2xl cards, soft violet glow on primary buttons / focused items, navy→indigo-violet gradient in sidebar + hero.
- [ ] Reusable primitives styled to theme: `Card`, `Button`, `Badge`, `Toast`. No default-looking shadcn left.

### Owl logo (`components/NudgeLogo.tsx`)
- [ ] Original minimal geometric SVG owl: rounded body, lavender→violet gradient, big circular eyes with amber pupils, small feather-tuft ears.
- [ ] Variants via props: `full` (owl + "Nudge" wordmark), `icon` (favicon/sidebar), `animated` (slow blink every few seconds; amber eyes **glow** when `urgent` prop is true).
- [ ] Export favicon + OG image generated from it (can use the icon variant; OG via `app/opengraph-image`).

### App layout
- [ ] Left **sidebar**: owl icon, nav items (Today, Meetings, Inbox, Tasks, Dev Activity, Weekly Update, Approvals, Memory & Skills, Settings), and **connection status dots** per tool (green/amber/grey).
- [ ] Main content area.
- [ ] Persistent right-side **Nudge Assistant chat panel**, collapsible. Static shell now; wired to the agent in PR-04/05. Placeholder prompt chips: "What do I have today?", "Draft my weekly update".
- [ ] Responsive: sidebar collapses on mobile; chat panel becomes a toggle.

### Welcome / Onboarding page (`/` first-run, or `/welcome`)
- [ ] Owl hero with tagline *"Your work, handled. Gently."*
- [ ] 3-step explainer: **1. Connect your tools → 2. Nudge watches your day → 3. You approve, Nudge does the work.**
- [ ] **"What Nudge can and cannot do"** panel — explicit: *"Nudge never sends emails, posts comments, or changes tickets without your OK."*
- [ ] Tool connection cards (Teams, Email, GitHub, Jira) each with a **permission toggle** (read-only / read + draft / act-with-approval). Visual only now; persisted in PR-10.
- [ ] **"Try with demo data"** button → routes to Today (wired once Today exists; stub route for now).

---

## Files to create

```
src/app/layout.tsx, globals.css, opengraph-image.tsx
src/app/(welcome)/page.tsx
src/components/NudgeLogo.tsx
src/components/layout/Sidebar.tsx
src/components/layout/ChatPanel.tsx
src/components/layout/ConnectionDots.tsx
src/components/ui/*  (themed Card, Button, Badge, Toast)
tailwind.config.ts  (token mapping)
```

---

## Acceptance criteria
- [ ] `npm run dev` renders the themed app with sidebar + collapsible chat panel.
- [ ] Owl logo appears in all three variants; animated owl blinks.
- [ ] Welcome page makes it obvious in 10s what Nudge does and that nothing happens without approval.
- [ ] Consistent navy/blue-violet theme; amber used only where allowed.
- [ ] Responsive at mobile + desktop widths; keyboard-navigable nav.

## Demo relevance
Opening shot of the video. Must land the "calm, premium, obviously-an-office-buddy" feeling instantly.
