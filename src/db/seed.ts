/**
 * Seeds a believable workday so Nudge's demo mode works with zero credentials.
 * Run with: npm run seed
 */
import { db } from "./index";
import {
  meetings,
  emails,
  tasks,
  jiraIssues,
  gitActivity,
  memories,
  skills,
  settings,
  reminders,
  drafts,
  pendingActions,
  activityLog,
  agentRuns,
  agentSteps,
  meetingPrep,
  insights,
} from "./schema";

/** A date today at the given 24h time. */
function at(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60000);
}
function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seed() {
  console.log("🌱 Seeding Nudge demo data…");

  // Clean slate (order doesn't matter — no FKs enforced)
  await db.delete(activityLog);
  await db.delete(insights);
  await db.delete(agentSteps);
  await db.delete(agentRuns);
  await db.delete(meetingPrep);
  await db.delete(pendingActions);
  await db.delete(drafts);
  await db.delete(reminders);
  await db.delete(skills);
  await db.delete(memories);
  await db.delete(gitActivity);
  await db.delete(jiraIssues);
  await db.delete(tasks);
  await db.delete(emails);
  await db.delete(meetings);
  await db.delete(settings);

  /* ---------------- Settings ---------------- */
  await db.insert(settings).values({
    id: "default",
    mode: "demo",
    userName: "Pushpender",
    toneDefault: "friendly",
  });

  /* ---------------- Meetings: last week, yesterday (with minutes) and today ---------------- */
  const todayName = new Date().toLocaleDateString("en-AU", { weekday: "long" });
  const [estimateReview, prevStandup, prevClientSync] = await db.insert(meetings).values([
    {
      title: "Project Atlas — Estimate Review",
      startsAt: daysAgo(6, 15),
      endsAt: daysAgo(6, 15, 45),
      attendees: ["Pushpender Singh", "Priya Nair", "Dan Whitlock"],
      transcript:
        "Priya: Northwind added SSO questions, so the original estimate no longer holds.\n" +
        "Dan: Then we revise it. Pushpender, can you send them the revised estimate before the next client sync?\n" +
        "Pushpender: Yes. I'll fold in the key rotation work and the read-only accounts.\n" +
        "Priya: And SSO testing moves to phase two. I'll confirm that scope with Claire.",
      hasMom: true,
    },
    {
      title: "Daily Standup — Platform Squad",
      startsAt: daysAgo(1, 9),
      endsAt: daysAgo(1, 9, 15),
      attendees: ["Pushpender Singh", "Priya Nair", "Dan Whitlock", "Marcus Lee"],
      transcript:
        "Pushpender: Key rotation PR is up, should merge today.\n" +
        "Marcus: Staging is flaky on the migration step again.\n" +
        "Dan: Marcus owns the pipeline fix. Pushpender, send him the failing migration logs.\n" +
        "Priya: I left comments on the findings export PR.",
      hasMom: true,
    },
    {
      title: "Project Atlas — Client Sync (Northwind)",
      startsAt: daysAgo(1, 11),
      endsAt: daysAgo(1, 11, 45),
      attendees: ["Pushpender Singh", "Priya Nair", "Claire Dawson (Northwind)", "Raj Patel (Northwind)"],
      transcript:
        "Claire: Our board meets next Wednesday, so we'd love the summary before then.\n" +
        "Pushpender: Executive summary by Friday. I'll also send an updated delivery timeline.\n" +
        "Raj: Can our team get read access to review findings?\n" +
        "Pushpender: I'll set up a read-only reviewer account this week.\n" +
        "Raj: I'll send the updated asset list this afternoon.",
      hasMom: true,
    },
  ]).returning({ id: meetings.id });

  await db.insert(meetings).values([
    {
      title: "Daily Standup — Platform Squad",
      startsAt: at(9, 0),
      endsAt: at(9, 15),
      attendees: ["Pushpender Singh", "Priya Nair", "Dan Whitlock", "Marcus Lee"],
      transcript:
        "Dan: Morning all, quick round. Pushpender, where are you at?\n" +
        "Pushpender: Key rotation merged yesterday, ATLAS-142 is in review. Today I'm on the Northwind timeline and the revised estimate.\n" +
        "Priya: Claire wants the timeline before the 11:00 sync, so that's first.\n" +
        "Marcus: Staging is still failing on the migration step. Pushpender, I still need those logs.\n" +
        "Pushpender: I'll send them right after standup.\n" +
        "Dan: Pushpender, please also get the read-only reviewer account set up by Thursday. Thanks everyone.",
      hasMom: false,
    },
    {
      title: "Project Atlas — Client Sync (Northwind)",
      startsAt: at(11, 0),
      endsAt: at(11, 45),
      attendees: ["Pushpender Singh", "Priya Nair", "Claire Dawson (Northwind)", "Raj Patel (Northwind)"],
      transcript: null,
      hasMom: false,
    },
    {
      title: "1:1 with Dan Whitlock",
      startsAt: at(14, 0),
      endsAt: at(14, 30),
      attendees: ["Pushpender Singh", "Dan Whitlock"],
      transcript:
        "Dan: How are you finding the Atlas workload?\n" +
        "Pushpender: Busy. The Friday deadline is tight but doable.\n" +
        "Dan: Don't forget your timesheet is due Friday. Let's review the weekly update together on Friday afternoon.",
      hasMom: false,
    },
    {
      title: "Design Review — Findings Export UI",
      startsAt: at(16, 0),
      endsAt: at(16, 45),
      attendees: ["Pushpender Singh", "Marcus Lee", "Priya Nair"],
      transcript: null,
      hasMom: false,
    },
  ]);

  /* ---------------- Minutes for past meetings (Historian reads these) ---------------- */
  await db.insert(drafts).values([
    {
      kind: "mom",
      targetType: "meeting",
      targetId: estimateReview.id,
      status: "approved",
      content: JSON.stringify({
        summary: "Northwind's SSO questions changed the scope, so the Atlas estimate needs revising before the next client sync.",
        decisions: ["Send Northwind a revised Atlas estimate before the next client sync", "SSO testing moves to phase two"],
        discussionPoints: ["Original estimate assumed no SSO work", "Key rotation and read-only accounts belong in the revision"],
        actionItems: [
          { title: "Send the revised Atlas estimate to Northwind", owner: "Pushpender Singh", due: "Before the next client sync" },
          { title: "Confirm phase-two SSO scope with Claire", owner: "Priya Nair", due: "Next week" },
        ],
      }),
    },
    {
      kind: "mom",
      targetType: "meeting",
      targetId: prevStandup.id,
      status: "approved",
      content: JSON.stringify({
        summary: "Key rotation is close to merging; staging is failing on the migration step and Marcus owns the fix.",
        decisions: ["Marcus owns the staging pipeline fix"],
        discussionPoints: ["Key rotation PR ready to merge", "Priya reviewed the findings export PR"],
        actionItems: [
          { title: "Send Marcus the failing migration logs", owner: "Pushpender Singh", due: todayName },
          { title: "Address Priya's comments on the findings export PR", owner: "Pushpender Singh", due: "This week" },
          { title: "Fix the staging migration step", owner: "Marcus Lee", due: "This week" },
        ],
      }),
    },
    {
      kind: "mom",
      targetType: "meeting",
      targetId: prevClientSync.id,
      status: "approved",
      content: JSON.stringify({
        summary: "Walked Northwind through progress. Claire's board meets next Wednesday, so the executive summary is due Friday.",
        decisions: ["Deliver the executive summary by Friday", "Northwind gets a read-only reviewer account"],
        discussionPoints: ["Board timing", "Read access for the Northwind team"],
        actionItems: [
          { title: "Send Northwind the updated delivery timeline", owner: "Pushpender Singh", due: todayName },
          { title: "Set up a read-only reviewer account for Northwind", owner: "Pushpender Singh", due: "Thursday" },
          { title: "Send the updated asset list", owner: "Raj Patel (Northwind)", due: "Yesterday afternoon" },
        ],
      }),
    },
  ]);

  /* ---------------- Emails (12; 2 urgent) ---------------- */
  await db.insert(emails).values([
    {
      fromName: "Priya Nair",
      fromEmail: "priya.nair@company.com",
      subject: "Northwind timeline: can you confirm before our 11:00?",
      body:
        "Hi Pushpender,\n\nClaire asked me for the updated delivery timeline before today's 11:00 sync. Can you confirm the dates by 10:30? " +
        "It ties in with what we agreed yesterday about the executive summary.\n\nThanks,\nPriya",
      receivedAt: minutesAgo(50),
    },
    {
      fromName: "Marcus Lee",
      fromEmail: "marcus.lee@company.com",
      subject: "URGENT: staging pipeline is down",
      body:
        "Pushpender, the staging deploy has been failing since this morning on the migration step, and QA is blocked. " +
        "Can you send me those migration logs as soon as you're in? This is holding up the whole squad.\n\nMarcus",
      receivedAt: minutesAgo(35),
    },
    {
      fromName: "Claire Dawson",
      fromEmail: "claire.dawson@northwind.com",
      subject: "Quick question on severity ratings",
      body:
        "Hi Pushpender,\n\nWill the summary use CVSS scores or your own severity scale? Our board is familiar with CVSS, so that would help. No rush, just flagging it.\n\nClaire",
      receivedAt: minutesAgo(16 * 60),
    },
    {
      fromName: "Priya Nair",
      fromEmail: "priya.nair@company.com",
      subject: "Atlas executive summary: first draft by Friday?",
      body: "Hi Pushpender,\n\nCould we look at a first draft of the executive summary together on Thursday afternoon? Friday is the hard deadline.\n\nPriya",
      receivedAt: minutesAgo(15 * 60),
    },
    {
      fromName: "Dan Whitlock",
      fromEmail: "dan.whitlock@company.com",
      subject: "Timesheet reminder",
      body: "Quick reminder the team timesheets are due Friday 5pm. Please get yours in. Thanks!",
      receivedAt: minutesAgo(18 * 60),
    },
    {
      fromName: "GitHub",
      fromEmail: "notifications@github.com",
      subject: "[atlas-api] PR #215 merged: Rotate JWT signing keys",
      body: "Dan Whitlock merged 'Rotate JWT signing keys (#215)' into main.",
      receivedAt: minutesAgo(17 * 60),
    },
    {
      fromName: "Raj Patel",
      fromEmail: "raj.patel@northwind.com",
      subject: "Updated asset list (attached)",
      body: "Hi Pushpender,\n\nAs discussed, here's the updated asset list for the assessment.\n\nRaj",
      receivedAt: minutesAgo(19 * 60),
    },
    {
      fromName: "Jira",
      fromEmail: "jira@company.atlassian.net",
      subject: "ATLAS-142 moved to In Review",
      body: "Pushpender Singh moved 'Harden authentication — rotate signing keys' (ATLAS-142) to In Review.",
      receivedAt: minutesAgo(17 * 60 - 5),
    },
    {
      fromName: "People & Culture",
      fromEmail: "people@company.com",
      subject: "Reminder: annual security training due this month",
      body: "You have one outstanding module in the annual security awareness training. Please complete it by month end.",
      receivedAt: minutesAgo(3 * 60),
    },
    {
      fromName: "Sofia Mendes",
      fromEmail: "sofia.mendes@company.com",
      subject: "Coffee next week?",
      body: "Hey! It's been ages. Fancy grabbing a coffee next week to catch up? No agenda, just a chat.",
      receivedAt: minutesAgo(2 * 60),
    },
    {
      fromName: "AWS Billing",
      fromEmail: "no-reply@aws.amazon.com",
      subject: "Your monthly cost report is ready",
      body: "Your AWS cost and usage report for the previous month is now available in the console.",
      receivedAt: minutesAgo(5 * 60),
    },
    {
      fromName: "Tech Weekly",
      fromEmail: "digest@techweekly.com",
      subject: "This week in security engineering",
      body: "The latest on zero-trust architectures, supply-chain security and more. Read in browser.",
      receivedAt: minutesAgo(6 * 60),
    },
  ]);

  /* ---------------- Jira issues (ATLAS-142 is ready to close) ---------------- */
  const base = "https://company.atlassian.net/browse";
  await db.insert(jiraIssues).values([
    { key: "ATLAS-142", summary: "Harden authentication — rotate signing keys", status: "In Review", assignee: "Pushpender Singh", updatedAt: daysAgo(1, 16, 5), url: `${base}/ATLAS-142`, doneToday: false },
    { key: "ATLAS-155", summary: "Read-only reviewer accounts for client teams", status: "In Progress", assignee: "Pushpender Singh", updatedAt: daysAgo(1, 12), url: `${base}/ATLAS-155`, doneToday: false },
    { key: "ATLAS-150", summary: "Executive summary generator for assessment reports", status: "To Do", assignee: "Pushpender Singh", updatedAt: daysAgo(2, 16), url: `${base}/ATLAS-150`, doneToday: false },
    { key: "ATLAS-139", summary: "Add findings export endpoint", status: "Done", assignee: "Pushpender Singh", updatedAt: daysAgo(3, 10, 15), url: `${base}/ATLAS-139`, doneToday: false },
    { key: "ATLAS-128", summary: "Fix staging migration step in CI pipeline", status: "Blocked", assignee: "Marcus Lee", updatedAt: minutesAgo(40), url: `${base}/ATLAS-128`, doneToday: false },
  ]);

  /* ---------------- Git activity (yesterday's key rotation work + older export work) ---------------- */
  await db.insert(gitActivity).values([
    { type: "commit", repo: "atlas-api", title: "refactor: extract token signing into KeyRotationService", ref: "c3d4e5f", url: "#", createdAt: daysAgo(1, 10, 20) },
    { type: "commit", repo: "atlas-api", title: "feat: rotate JWT signing keys on a schedule", ref: "d4e5f6a", url: "#", createdAt: daysAgo(1, 13, 40) },
    { type: "commit", repo: "atlas-api", title: "test: cover key rotation grace period", ref: "e7f8a9b", url: "#", createdAt: daysAgo(1, 14, 55) },
    { type: "commit", repo: "atlas-api", title: "docs: key rotation runbook", ref: "f1a2b3c", url: "#", createdAt: daysAgo(1, 15, 30) },
    { type: "pr", repo: "atlas-api", title: "Rotate JWT signing keys (#215)", ref: "215", url: "#", createdAt: daysAgo(1, 16) },
    { type: "commit", repo: "atlas-api", title: "feat: add /findings/export endpoint with CSV + JSON", ref: "a1b2c3d", url: "#", createdAt: daysAgo(3, 9, 40) },
    { type: "pr", repo: "atlas-api", title: "Add findings export endpoint (#212)", ref: "212", url: "#", createdAt: daysAgo(3, 10, 12) },
  ]);

  /* ---------------- A couple of tasks you added yourself (Planner builds the rest) ---------------- */
  await db.insert(tasks).values([
    { title: "Submit weekly timesheet", due: null, priority: "this_week", source: "manual", sortOrder: 0 },
    { title: "Book travel for the Melbourne offsite", due: null, priority: "this_week", source: "manual", sortOrder: 1 },
  ]);

  /* ---------------- Memories ---------------- */
  await db.insert(memories).values([
    { type: "person", content: "Priya Nair is the Product Manager on Project Atlas. She prefers concise, direct status updates.", source: "seed" },
    { type: "person", content: "Dan Whitlock is my manager. He likes a short status with blockers called out clearly.", source: "seed" },
    { type: "person", content: "Claire Dawson is the client stakeholder at Northwind; her board is familiar with CVSS scoring.", source: "seed" },
    { type: "project", content: "Project Atlas is a security assessment & reporting platform. Current sprint: findings export and authentication hardening. SSO is phase two.", source: "seed" },
    { type: "preference", content: "I prefer concise, friendly emails that get to the point quickly.", source: "seed" },
    { type: "style", content: "I open emails with a short greeting, keep paragraphs short, and sign off with 'Cheers, Pushpender'.", source: "seed" },
  ]);

  /* ---------------- Skills (10) ---------------- */
  await db.insert(skills).values([
    { id: "meeting-to-mom", name: "Meeting → MoM", description: "Turn a meeting transcript into minutes: summary, decisions, discussion and action items.", sortOrder: 0 },
    { id: "email-triage", name: "Email triage", description: "Sort incoming email into Urgent, Needs reply and FYI.", sortOrder: 1 },
    { id: "email-reply-draft", name: "Email reply draft", description: "Draft a reply in your tone, ready for your approval.", sortOrder: 2 },
    { id: "task-extractor", name: "Task extractor", description: "Pull action items and to-dos out of meetings and emails.", sortOrder: 3 },
    { id: "jira-closing-comment", name: "Jira closing comment", description: "Draft a closing comment and suggest a status transition for finished work.", sortOrder: 4 },
    { id: "jira-update-suggester", name: "Jira update suggester", description: "Suggest Jira updates based on today's commits and PRs.", sortOrder: 5 },
    { id: "github-daily-digest", name: "GitHub daily digest", description: "Turn today's commits and PRs into a plain-language progress summary.", sortOrder: 6 },
    { id: "weekly-update", name: "Weekly update", description: "Compile the week's work into a highlights / progress / blockers / next-week report.", sortOrder: 7 },
    { id: "morning-brief", name: "Morning brief", description: "Summarise your day each morning across every connected tool.", sortOrder: 8 },
    { id: "reminder-engine", name: "Reminder engine", description: "Friendly, well-timed reminders for timesheets, check-ins and reports.", sortOrder: 9 },
  ]);

  /* ---------------- Reminders ---------------- */
  await db.insert(reminders).values([
    { kind: "timesheet", schedule: "Fri 17:00", message: "Hoo's got a timesheet due? You do! Friday 5 PM.", enabled: true },
    { kind: "eod", schedule: "Daily 17:30", message: "Winding down? Here's what you handled today.", enabled: true },
    { kind: "weekly", schedule: "Fri 16:00", message: "It's Friday — your weekly update is ready to review.", enabled: true },
  ]);

  console.log("✅ Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
