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
} from "./schema";

/** A date today at the given 24h time. */
function at(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}
function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seed() {
  console.log("🌱 Seeding Nudge demo data…");

  // Clean slate (order doesn't matter — no FKs enforced)
  await db.delete(activityLog);
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

  /* ---------------- Meetings (4; 3 with transcripts) ---------------- */
  await db.insert(meetings).values([
    {
      title: "Daily Standup — Platform Squad",
      startsAt: at(9, 0),
      endsAt: at(9, 15),
      attendees: ["Pushpender Singh", "Priya Nair", "Dan Whitlock", "Marcus Lee"],
      transcript:
        "Dan: Morning all, quick round. Pushpender, where are you at?\n" +
        "Pushpender: I finished the findings export endpoint yesterday, PR is up for review. Today I'm on the auth hardening — rotating the token signing keys.\n" +
        "Priya: Great. The client asked for the Atlas assessment summary — can we get a draft to them by Friday?\n" +
        "Pushpender: Yes, I'll pull it together.\n" +
        "Marcus: I'm blocked on the staging deploy, the pipeline is failing on the migration step.\n" +
        "Dan: Let's pair on that after standup. Anything else? No. Thanks everyone.",
      hasMom: false,
    },
    {
      title: "Project Atlas — Client Sync (Northwind)",
      startsAt: at(11, 0),
      endsAt: at(11, 45),
      attendees: ["Pushpender Singh", "Priya Nair", "Claire Dawson (Northwind)", "Raj Patel (Northwind)"],
      transcript:
        "Priya: Thanks for joining. Today we want to walk through the assessment progress and agree on the delivery date.\n" +
        "Claire: Our board meets next Wednesday, so we'd love the summary before then.\n" +
        "Pushpender: We're on track. The findings export is done, and we're hardening authentication this week. I can have the executive summary to you by Friday.\n" +
        "Raj: Can the report include severity ratings and remediation steps per finding?\n" +
        "Pushpender: Yes — each finding will have a CVSS-style severity and a recommended fix.\n" +
        "Claire: One concern — the SSO integration. Is that in scope?\n" +
        "Priya: It's in scope for phase two. We'll note it as a follow-up.\n" +
        "Decision: Deliver the executive summary by Friday. SSO testing moves to phase two.\n" +
        "Claire: Perfect. Raj will send the updated asset list this afternoon.\n" +
        "Pushpender: Great, I'll fold that in. I'll also set up a read-only account for your team to review findings.",
      hasMom: false,
    },
    {
      title: "1:1 with Dan Whitlock",
      startsAt: at(14, 0),
      endsAt: at(14, 30),
      attendees: ["Pushpender Singh", "Dan Whitlock"],
      transcript:
        "Dan: How are you finding the Atlas workload?\n" +
        "Pushpender: Good, busy. The Friday deadline is tight but doable.\n" +
        "Dan: If you need Marcus to take the migration work, say the word. Also — don't forget your timesheet is due Friday.\n" +
        "Pushpender: Noted. I'll get Marcus to own the staging pipeline.\n" +
        "Dan: Let's review the weekly update together on Friday afternoon.",
      hasMom: false,
    },
    {
      title: "Design Review — Findings Export UI",
      startsAt: at(16, 0),
      endsAt: at(16, 45),
      attendees: ["Pushpender Singh", "Marcus Lee", "Priya Nair"],
      transcript: null, // upcoming — no transcript yet
      hasMom: false,
    },
  ]);

  /* ---------------- Emails (12; 2 urgent) ---------------- */
  await db.insert(emails).values([
    {
      fromName: "Priya Nair",
      fromEmail: "priya.nair@company.com",
      subject: "Atlas executive summary — need it before Friday",
      body:
        "Hi Pushpender,\n\nNorthwind's board meets next Wednesday and Claire has asked for the Atlas executive summary before then. Can you confirm you'll have a draft ready by Friday? I'd like to review it with you before it goes out.\n\nThanks,\nPriya",
      receivedAt: at(9, 32),
      triage: null,
    },
    {
      fromName: "Marcus Lee",
      fromEmail: "marcus.lee@company.com",
      subject: "URGENT: staging pipeline is down",
      body:
        "Pushpender — the staging deploy has been failing since this morning on the migration step, and QA is blocked. Can you take a look or point me at who can? This is holding up the whole squad.\n\nMarcus",
      receivedAt: at(9, 58),
      triage: null,
    },
    {
      fromName: "Claire Dawson",
      fromEmail: "claire.dawson@northwind.com",
      subject: "Thanks + updated asset list to follow",
      body:
        "Hi Pushpender,\n\nGreat to catch up this morning. Raj will send the updated asset list this afternoon. Looking forward to the summary on Friday.\n\nBest,\nClaire",
      receivedAt: at(11, 52),
      triage: null,
    },
    {
      fromName: "Dan Whitlock",
      fromEmail: "dan.whitlock@company.com",
      subject: "Timesheet reminder",
      body: "Quick reminder the team timesheets are due Friday 5pm. Please get yours in. Thanks!",
      receivedAt: at(8, 45),
      triage: null,
    },
    {
      fromName: "GitHub",
      fromEmail: "notifications@github.com",
      subject: "[atlas-api] PR #212 approved by Dan Whitlock",
      body: "Your pull request 'Add findings export endpoint' was approved. You can now merge it.",
      receivedAt: at(10, 15),
      triage: null,
    },
    {
      fromName: "Raj Patel",
      fromEmail: "raj.patel@northwind.com",
      subject: "Updated asset list (attached)",
      body:
        "Hi Pushpender,\n\nAs discussed, here's the updated asset list for the assessment. Let me know if you need anything else before Friday.\n\nRaj",
      receivedAt: at(13, 20),
      triage: null,
    },
    {
      fromName: "People & Culture",
      fromEmail: "people@company.com",
      subject: "Reminder: annual security training due this month",
      body: "You have one outstanding module in the annual security awareness training. Please complete it by month end.",
      receivedAt: at(7, 50),
      triage: null,
    },
    {
      fromName: "Jira",
      fromEmail: "jira@company.atlassian.net",
      subject: "ATLAS-142 assigned to you",
      body: "Priya Nair assigned 'Harden authentication — rotate signing keys' (ATLAS-142) to you.",
      receivedAt: at(9, 5),
      triage: null,
    },
    {
      fromName: "Sofia Mendes",
      fromEmail: "sofia.mendes@company.com",
      subject: "Coffee next week?",
      body: "Hey! It's been ages. Fancy grabbing a coffee next week to catch up? No agenda, just a chat.",
      receivedAt: at(12, 10),
      triage: null,
    },
    {
      fromName: "AWS Billing",
      fromEmail: "no-reply@aws.amazon.com",
      subject: "Your monthly cost report is ready",
      body: "Your AWS cost and usage report for the previous month is now available in the console.",
      receivedAt: at(6, 30),
      triage: null,
    },
    {
      fromName: "Claire Dawson",
      fromEmail: "claire.dawson@northwind.com",
      subject: "Quick question on severity ratings",
      body:
        "Hi Pushpender,\n\nWill the summary use CVSS scores or your own severity scale? Our board is familiar with CVSS, so that would help. No rush — just wanted to flag it.\n\nClaire",
      receivedAt: at(13, 48),
      triage: null,
    },
    {
      fromName: "Tech Weekly",
      fromEmail: "digest@techweekly.com",
      subject: "This week in security engineering",
      body: "The latest on zero-trust architectures, supply-chain security and more. Read in browser.",
      receivedAt: at(5, 15),
      triage: null,
    },
  ]);

  /* ---------------- Jira issues (5; 1 done today) ---------------- */
  const base = "https://company.atlassian.net/browse";
  await db.insert(jiraIssues).values([
    {
      key: "ATLAS-142",
      summary: "Harden authentication — rotate signing keys",
      status: "In Progress",
      assignee: "Pushpender Singh",
      updatedAt: at(9, 10),
      url: `${base}/ATLAS-142`,
      doneToday: false,
    },
    {
      key: "ATLAS-139",
      summary: "Add findings export endpoint",
      status: "In Review",
      assignee: "Pushpender Singh",
      updatedAt: at(10, 15),
      url: `${base}/ATLAS-139`,
      doneToday: false,
    },
    {
      key: "ATLAS-131",
      summary: "Per-finding severity ratings (CVSS)",
      status: "Done",
      assignee: "Pushpender Singh",
      updatedAt: at(15, 20),
      url: `${base}/ATLAS-131`,
      doneToday: true,
    },
    {
      key: "ATLAS-150",
      summary: "Executive summary generator for assessment reports",
      status: "To Do",
      assignee: "Pushpender Singh",
      updatedAt: daysAgo(1, 16),
      url: `${base}/ATLAS-150`,
      doneToday: false,
    },
    {
      key: "ATLAS-128",
      summary: "Fix staging migration step in CI pipeline",
      status: "Blocked",
      assignee: "Marcus Lee",
      updatedAt: at(9, 59),
      url: `${base}/ATLAS-128`,
      doneToday: false,
    },
  ]);

  /* ---------------- Git activity (6 commits + 2 PRs) ---------------- */
  await db.insert(gitActivity).values([
    { type: "commit", repo: "atlas-api", title: "feat: add /findings/export endpoint with CSV + JSON", ref: "a1b2c3d", url: "#", createdAt: at(9, 40) },
    { type: "commit", repo: "atlas-api", title: "test: cover findings export with severity ratings", ref: "b2c3d4e", url: "#", createdAt: at(10, 5) },
    { type: "commit", repo: "atlas-api", title: "refactor: extract token signing into KeyRotationService", ref: "c3d4e5f", url: "#", createdAt: at(13, 30) },
    { type: "commit", repo: "atlas-api", title: "feat: rotate JWT signing keys on a schedule", ref: "d4e5f6a", url: "#", createdAt: at(14, 50) },
    { type: "commit", repo: "atlas-web", title: "feat: severity badges on findings table (CVSS colours)", ref: "e5f6a7b", url: "#", createdAt: at(15, 10) },
    { type: "commit", repo: "atlas-web", title: "fix: export button disabled state while generating", ref: "f6a7b8c", url: "#", createdAt: at(15, 35) },
    { type: "pr", repo: "atlas-api", title: "Add findings export endpoint (#212)", ref: "212", url: "#", createdAt: at(10, 12) },
    { type: "pr", repo: "atlas-web", title: "Findings severity badges (#88)", ref: "88", url: "#", createdAt: at(15, 40) },
  ]);

  /* ---------------- A few starter tasks (varied sources) ---------------- */
  await db.insert(tasks).values([
    { title: "Draft Atlas executive summary for Northwind", due: at(17, 0), priority: "urgent", source: "email", sortOrder: 0 },
    { title: "Rotate JWT signing keys (ATLAS-142)", due: null, priority: "today", source: "jira", sourceId: "ATLAS-142", sortOrder: 1 },
    { title: "Hand staging pipeline over to Marcus", due: null, priority: "today", source: "meeting", sortOrder: 2 },
    { title: "Submit weekly timesheet", due: at(17, 0), priority: "this_week", source: "manual", sortOrder: 3 },
    { title: "Reply to Claire re: CVSS severity scale", due: null, priority: "this_week", source: "email", sortOrder: 4 },
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
