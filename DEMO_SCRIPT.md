# Nudge — 3-minute demo script 🦉

A tight run-through for the demo video. Total ≈ 3:00.

## Before you record (setup)

```bash
npm install
npm run setup          # schema + seed the demo workday
# .env has NEBIUS_API_KEY set
npm run dev
```

- Confirm models: `npm run models`, set `MODEL_HEAVY` / `MODEL_FAST` in `.env`.
- Open `http://localhost:3000` at the **Welcome** page.
- Dark room / full-screen browser. Have the Inbox's urgent Priya email in mind.
- Tip: re-run `npm run seed` for a clean slate before the final take.

---

## Beat sheet

### 1 · Welcome — what Nudge is (0:00–0:15)
- Land on the Welcome page. Read the tagline: *"Your work, handled. Gently."*
- Point to the **"What Nudge can & cannot do"** panel — emphasise *"never sends emails or
  changes tickets without your OK."*
- Click **Try with demo data**.

### 2 · Today — watch Nudge plan the day (0:15–0:35)
- Run `npm run seed` first so the first open of Today plans the day live.
- The owl says **"Let me plan your day for you."** and the subtitle names the agent at work
  (Historian → Courier → Tracker → Planner → Nudge). Each step narrates what it found, with
  handoffs between agents; **Show details** reveals tool, model tier, duration and items.
- When it finishes, the stream collapses into **How I planned this** (Replay re-plays the
  stored steps, with no new model calls). Below it: **Today's insights**, **Needs your OK**,
  and the **To-do tasks** rail.
- **Simulate… → An urgent email arrives**: the banner shows Courier working; **Watch** opens
  the live stream in a drawer, and a new approval card and urgent task appear when it's done.

### 3 · Inbox — the hero flow (0:35–1:35) ⭐
- Go to **Inbox**, click **Triage inbox** → emails sort into Urgent / Needs reply / FYI,
  and an **urgent task is auto-created** (amber dot).
- Open **Priya's urgent email**. Read Nudge's triage reason.
- Click **Draft a reply** (tone: friendly) → a drafted reply appears in your voice.
- (Optional) **Edit** a line to show Nudge *learns your style*.
- Click **Approve & Send** → success toast, email marked sent.
- Back on **Today**: the drafted reply and the created task are there.
  *Nothing happened without approval.*

### 4 · Meetings → minutes (1:35–2:05)
- Go to **Meetings**, pick the **Client Sync**, click **Generate MoM**.
- Show summary, decisions, discussion, action items.
- Click **Add all to tasks** → confirm they appear in **Tasks** with a "meeting" badge.

### 5 · Weekly update (2:05–2:30)
- Go to **Weekly Update**, click **Generate**.
- Show Highlights / Progress / Blockers / Next week assembled from the week's meetings,
  email, commits and Jira. **Export .md**.

### 6 · The personal-AI story (2:30–2:50)
- **Memory & Skills:** show remembered people/preferences/writing-style cards and the
  skill on/off toggles.
- **Settings:** per-tool permission levels + the privacy statement (data stays local).
- Click the **bell → "Try a reminder now → Timesheet"** → the friendly owl toast fires.
  *Always-on background tasks.*

### 7 · Close (2:50–3:00)
- Back to Today. "Every bit of this ran on **NVIDIA Nemotron via Nebius Token Factory** —
  and Nudge never did anything without my OK."
- End on the owl + tagline.

---

## One-line pitch

> Nudge is your private AI office buddy: it watches your day across Teams, email, GitHub
> and Jira, drafts the admin, and hands you one-click approvals — powered by NVIDIA
> Nemotron on Nebius Token Factory.
