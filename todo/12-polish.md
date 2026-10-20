# PR-12 — Polish (empty / loading / error states, animation, responsive, a11y)

- **Branch:** `pr-12-polish`
- **Tier:** continuous — applied as you go, finalised before the demo
- **Depends on:** all pages exist
- **Goal:** Make every screen feel finished. Empty states that teach, loading states
  with the owl, graceful errors, subtle animation, responsive layout, accessibility.

---

## Scope / tasks

### Empty states (teach each feature — spec §5)
- [ ] Every page/section has a plain-language empty state explaining what the feature does and a next action (e.g. Inbox empty: "No emails to triage — Nudge will sort them into Urgent / Needs reply / FYI as they arrive").

### Loading states
- [ ] Consistent **"Nudge is thinking…"** with the animated owl for all skill calls.
- [ ] Skeletons for lists/cards; streamed model output where possible.

### Error handling
- [ ] Friendly owl error messages for model/connector/API failures — no stack traces, no secrets. ("Nudge couldn't reach its brain just now — try again?")
- [ ] Retry affordances.

### Animation (subtle only — Framer Motion)
- [ ] Owl slow blink; amber eye glow on urgent; gentle card enter/hover; approval success micro-animation. Nothing distracting.

### Responsive + accessibility
- [ ] Works at mobile and desktop widths; sidebar + chat panel collapse gracefully.
- [ ] Accessible contrast (verify amber/lavender on navy), focus rings, keyboard navigation, ARIA labels, reduced-motion support.

### Consistency sweep
- [ ] No default-looking shadcn components remain; amber used **only** for owl eyes / urgent / "Nudge says…".
- [ ] Spacing, radius (rounded-2xl), violet glow consistent across pages.

## Acceptance criteria
- [ ] No empty screen without an explanatory empty state.
- [ ] No raw error or spinner-less load.
- [ ] Passes a keyboard-only walk-through of the hero flow.
- [ ] Theme consistent everywhere; respects reduced-motion.

## Demo relevance
Polish is most of the "premium, calm, obviously-finished" impression judges score on. Budget real time for it before recording.
