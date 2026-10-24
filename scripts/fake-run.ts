/**
 * Dev only: inserts a plan_day-like run and writes its steps over ~10 s so the
 * agent graph can be watched live at /runs/<id>.
 *   npx tsx scripts/fake-run.ts [--session <key>] [--fast]
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { agentRuns, agentSteps, type FoundItem } from "../src/db/schema";
import type { SceneScript } from "../src/nudge/scenes";

const args = process.argv.slice(2);
const sessionKey = args.includes("--session") ? args[args.indexOf("--session") + 1] : "live";
const fast = args.includes("--fast");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, fast ? ms / 10 : ms));

const FAST = "nvidia/NVIDIA-Nemotron-Nano-9B-v2";
const HEAVY = "nvidia/Llama-3_3-Nemotron-Super-49B-v1_5";

type FakeStep = {
  agent: string;
  phase: string;
  tool: string;
  tier: "fast" | "heavy" | "none";
  narration: string;
  found?: FoundItem[];
  handoffTo?: string;
  handoffSummary?: string;
  ms: number;
};

const STEPS: FakeStep[] = [
  { agent: "Nudge", phase: "Routing", tool: "route_plan_day", tier: "fast", ms: 900, narration: "Morning, Aarav. I'll have the team look through yesterday, your PRs and today's calendar.", handoffTo: "Historian", handoffSummary: "Find what Aarav did yesterday and what he said he'd do." },
  { agent: "Historian", phase: "Fetching context", tool: "memory.notes, github.listCommits", tier: "none", ms: 1600, narration: "Yesterday's standup: finish webhook retries, start the invoices bug. 3 commits on feat/webhook-retry.", found: [
    { kind: "memory", label: "Standup: finish webhook retries, start invoices bug", detail: "Yesterday" },
    { kind: "commit", label: "Add exponential backoff to webhook retry", detail: "feat/webhook-retry", href: "https://github.com/nudge/nudge-api/commit/a1b2c3d" },
  ], handoffTo: "Tracker", handoffSummary: "Yesterday's work was on feat/webhook-retry; check the PR and ticket." },
  { agent: "Tracker", phase: "Checking PRs and tickets", tool: "github.listPullRequests, jira.listTickets", tier: "none", ms: 1700, narration: "PR #212 is open for NUD-142, but the ticket still says To Do.", found: [
    { kind: "pr", label: "PR #212 Add retry to payment webhook", detail: "open", href: "https://github.com/nudge/nudge-api/pull/212" },
    { kind: "jira", label: "NUD-142 still To Do", detail: "PR open since yesterday", urgent: true },
    { kind: "jira", label: "NUD-150 Fix 500 on /invoices export", detail: "P1 · due today" },
  ], handoffTo: "Planner", handoffSummary: "1 mismatch (NUD-142), 7 open tickets with estimates." },
  { agent: "Planner", phase: "Ranking tasks", tool: "calendar.listEvents, rank_tasks", tier: "heavy", ms: 2000, narration: "Top 3: NUD-150 (due today, customer escalation), Priya's review on #209, NUD-153 fits before 14:00.", found: [
    { kind: "task", label: "NUD-150 Fix 500 on /invoices export", detail: "Due today" },
    { kind: "task", label: "NUD-147 Review Priya's auth refactor #209", detail: "Unblocks Priya" },
    { kind: "task", label: "NUD-153 Add pagination to /orders", detail: "3 h, fits the morning" },
    { kind: "meeting", label: "Standup 10:30, sprint planning 14:00, 1:1 17:00" },
  ], handoffTo: "Reporter", handoffSummary: "Picks and a 3-hour morning window." },
  { agent: "Reporter", phase: "Drafting standup", tool: "draft_standup", tier: "heavy", ms: 1500, narration: "Drafted Yesterday / Today / Blockers from the commits, tickets and plan.", found: [
    { kind: "draft", label: "Standup draft for #team-standup", detail: "3 sections" },
  ], handoffTo: "Courier", handoffSummary: "Standup ready; check the inbox for anything urgent." },
  { agent: "Courier", phase: "Triaging inbox", tool: "email.listInbox, draft_reply", tier: "fast", ms: 1300, narration: "Support emailed about the invoices export failing. I drafted a reply; it's waiting for your OK.", found: [
    { kind: "email", label: "Support: invoices export failing for Acme", detail: "Links to NUD-150" },
    { kind: "draft", label: "Reply draft to Support", detail: "Needs your OK" },
  ], handoffTo: "Nudge", handoffSummary: "1 urgent email, reply drafted." },
  { agent: "Nudge", phase: "Writing the briefing", tool: "scene_script", tier: "heavy", ms: 1000, narration: "Your briefing is ready: one catch, three picks, a plan and a standup." },
];

const SCRIPT: SceneScript = {
  scenes: [
    { id: "welcome", agent: "Nudge", speech: "Morning, Aarav. Ready to start your day?", captionHighlights: ["Aarav"], reveals: [{ section: "welcome" }] },
    { id: "catch", agent: "Tracker", speech: "You opened PR 212 for NUD-142 yesterday, but the ticket still says To Do. Want me to move it to In Review?", captionHighlights: ["PR 212", "NUD-142", "To Do"], reveals: [{ section: "catch" }], interaction: { type: "confirm" } },
    { id: "picks", agent: "Planner", speech: "I'd pick from these three today.", captionHighlights: [], reveals: [{ section: "picks" }], interaction: { type: "choice", options: [
      { id: "NUD-150", label: "NUD-150 Fix 500 on /invoices export" },
      { id: "NUD-147", label: "NUD-147 Review Priya's PR #209" },
      { id: "NUD-153", label: "NUD-153 Add pagination to /orders" },
    ] } },
    { id: "standup", agent: "Reporter", speech: "Here's your standup. Anything you want to change?", captionHighlights: [], reveals: [{ section: "standup" }], interaction: { type: "edit" } },
  ],
};

async function main() {
  const [run] = await db.insert(agentRuns).values({ trigger: "plan_day", title: "Plan my day (dev fake run)", status: "running", sessionKey }).returning();
  console.log(`run ${run.id} (session ${sessionKey})`);
  console.log(`watch: http://localhost:3104/runs/${run.id}`);
  await sleep(800);
  let seq = 0;
  for (const s of STEPS) {
    const [row] = await db.insert(agentSteps).values({
      runId: run.id,
      seq: ++seq,
      agent: s.agent,
      action: s.phase,
      tool: s.tool,
      model: s.tier === "heavy" ? HEAVY : s.tier === "fast" ? FAST : "none",
      modelTier: s.tier,
      inputSummary: s.phase,
      outputSummary: "",
      status: "running",
    }).returning();
    await sleep(s.ms);
    await db.update(agentSteps).set({
      status: "done",
      narration: s.narration,
      outputSummary: s.narration,
      foundItems: s.found ?? [],
      handoffTo: s.handoffTo ?? null,
      handoffSummary: s.handoffSummary ?? null,
      finishedAt: new Date(),
    }).where(eq(agentSteps.id, row.id));
    console.log(`  ${seq}. ${s.agent}: ${s.phase}`);
    await sleep(150);
  }
  await db.update(agentRuns).set({
    status: "done",
    summary: "One catch (NUD-142), three picks, a planned morning and a standup draft.",
    sceneScript: SCRIPT,
    scriptSource: "template",
    answers: { catch: { decision: "confirm", via: "voice" }, pick: { choiceId: "NUD-150", via: "click" } },
    finishedAt: new Date(),
  }).where(eq(agentRuns.id, run.id));
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
