import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { agentRuns, drafts, emails, insights, pendingActions, tasks } from "@/db/schema";
import type { Email, FoundItem, JiraIssue, TaskSource } from "@/db/schema";
import { queueAction } from "@/ai/approvals";
import { hasApiKey } from "@/ai/client";
import { getRelevantMemories } from "@/ai/memory";
import { runSkill } from "@/ai/orchestrator";
import { emailReplyDraftSkill } from "@/skills/email-reply-draft";
import { jiraClosingCommentSkill } from "@/skills/jira-closing-comment";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { formatTime } from "@/lib/utils";
import { createRun, describePayload, finishRun, stepper } from "./runs";
import { listNames, narrate } from "./narrate";
import {
  CandidateBook,
  dayBounds,
  doneTaskTitles,
  emailItem,
  fetchEmails,
  fetchGit,
  fetchJira,
  fetchMeetings,
  fetchMoms,
  gitItem,
  jiraItem,
  meetingItem,
  overlap,
  relativeDayLabel,
} from "./context";

type ActionItem = { ref: string; title: string; owner: string; due: string; meeting: string; meetingId: string; meetingRef: string; dueToday: boolean; forUser: boolean };
type Decision = { ref: string; text: string; meeting: string; meetingRef: string; when: string };
type InsightDraft = { text: string; ref: string | null };
type Triaged = { email: Email; ref: string; triage: "urgent" | "needs_reply" | "fyi"; reason: string; linkedTo?: string };
type CloseCandidate = { issue: JiraIssue; ref: string; reason: string; work: string[] };

/**
 * plan_day: Historian → Courier → Tracker → Planner → Nudge.
 * Each agent fetches real data, narrates it with one model call, and hands a
 * structured payload to the next. Nothing outward-facing runs here: replies and
 * Jira comments are queued as pending actions for the user's OK.
 */
export async function runPlanDay(runId: string) {
  const settings = await getSettings();
  const firstName = settings.userName.split(" ")[0].toLowerCase();
  const now = new Date();
  const { dayStart, dayEnd } = dayBounds(now);
  const weekday = now.toLocaleDateString("en-AU", { weekday: "long" });
  const book = new CandidateBook();
  const step = stepper(runId);

  /* ---------------- 1. Historian: previous meetings, minutes, open items ---------------- */
  const meetingsRes = await fetchMeetings();
  const moms = await fetchMoms();
  const done = await doneTaskTitles();
  const past = meetingsRes.rows.filter((m) => m.startsAt < dayStart).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const today = meetingsRes.rows.filter((m) => m.startsAt >= dayStart && m.startsAt < dayEnd).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const lastDay = past[0] ? dayBounds(past[0].startsAt).dayStart : null;
  const previous = lastDay ? past.filter((m) => m.startsAt >= lastDay) : [];
  const prevLabel = previous[0] ? relativeDayLabel(previous[0].startsAt, now) : "yesterday";
  const meetingRef = new Map<string, string>();
  [...previous, ...past.slice(0, 12), ...today].forEach((m, i) => {
    if (!meetingRef.has(m.id)) meetingRef.set(m.id, book.add(`meeting:${i + 1}`, meetingItem(m)));
  });

  const actionItems: ActionItem[] = [];
  const decisions: Decision[] = [];
  const fortnight = new Date(dayStart.getTime() - 14 * 86400000);
  for (const m of past.filter((p) => p.startsAt >= fortnight)) {
    const mom = moms.get(m.id);
    if (!mom) continue;
    const mRef = meetingRef.get(m.id)!;
    for (const item of mom.actionItems) {
      if (done.some((t) => t.includes(item.title.toLowerCase()) || item.title.toLowerCase().includes(t))) continue;
      const ref = book.add(`action:${actionItems.length + 1}`, { kind: "action_item", label: item.title, detail: `${item.owner.split(" ")[0]} · ${item.due}`, href: "/meetings" });
      const due = item.due.toLowerCase();
      actionItems.push({
        ref,
        title: item.title,
        owner: item.owner,
        due: item.due,
        meeting: m.title,
        meetingId: m.id,
        meetingRef: mRef,
        dueToday: due.includes("today") || due.includes(weekday.toLowerCase()),
        forUser: item.owner.toLowerCase().includes(firstName) || ["me", "you"].includes(item.owner.toLowerCase()),
      });
    }
    for (const text of mom.decisions) {
      const ref = book.add(`decision:${decisions.length + 1}`, { kind: "decision", label: text, detail: m.title, href: "/meetings" });
      decisions.push({ ref, text, meeting: m.title, meetingRef: mRef, when: relativeDayLabel(m.startsAt, now) });
    }
  }
  const prevIds = new Set(previous.map((m) => m.id));
  const prevActionItems = actionItems.filter((a) => prevIds.has(a.meetingId));
  const userItems = actionItems.filter((a) => a.forUser);

  await step(
    { agent: "Historian", phase: "Fetching context", tool: "Teams, Memory", tier: "fast", input: `Meetings ${prevLabel}, their minutes and open action items` },
    async () => {
      const facts = {
        previousMeetingDay: prevLabel,
        meetings: previous.map((m) => ({ ref: meetingRef.get(m.id), title: m.title, time: formatTime(m.startsAt), minutes: moms.get(m.id)?.summary ?? "no minutes yet" })),
        openActionItems: prevActionItems.map((a) => ({ ref: a.ref, title: a.title, owner: a.owner, due: a.due, dueToday: a.dueToday })),
        todayIs: weekday,
        calendarError: meetingsRes.error,
      };
      const dueToday = prevActionItems.filter((a) => a.dueToday);
      const out = await narrate({
        agent: "Historian",
        phase: "Fetching context",
        tier: "fast",
        task: `Tell the user which meetings they had ${prevLabel}, that you pulled the minutes, how many action items are still open and which are due today. Then say you'll look for older context that matters today.`,
        facts,
        candidates: book.pick(["meeting:", "action:"]).filter((c) => previous.some((m) => meetingRef.get(m.id) === c.ref) || prevActionItems.some((a) => a.ref === c.ref)),
        extra: {},
        extraHint: "",
        fallback: () => ({
          narration: meetingsRes.error
            ? "I couldn't reach your calendar, so I'll work from the meeting notes I already have."
            : previous.length
              ? `${cap(prevLabel)} you had ${previous.length} meeting${previous.length === 1 ? "" : "s"}: ${listNames(previous.map((m) => m.title))}. I've pulled the minutes; ${prevActionItems.length ? `${prevActionItems.length} action item${prevActionItems.length === 1 ? " is" : "s are"} still open${dueToday.length ? `, and ${dueToday.length} ${dueToday.length === 1 ? "is" : "are"} due today` : ""}` : "nothing from them is still open"}.`
              : "I couldn't find any recent meetings, so I'll lean on older notes.",
          found: [...previous.map((m) => meetingRef.get(m.id)!), ...prevActionItems.map((a) => a.ref)],
          extra: {},
        }),
      });
      return { ...out, result: null, handoffTo: "Historian", handoffSummary: describePayload([[previous.length, "meeting", "meetings"], [prevActionItems.length, "open item", "open items"]]) };
    },
    { narration: "I had trouble reading your recent meetings, so I'll carry on with what else I can find.", result: null, handoffTo: "Historian" }
  );

  /* ---------------- 2. Historian: older commitments that matter today ---------------- */
  const memories = await getRelevantMemories(today.map((m) => m.title).join(" ") + " " + actionItems.map((a) => a.title).join(" "), 5);
  const historianInsights = await step(
    { agent: "Historian", phase: "Finding insights", tool: "Memory, Meetings", tier: "heavy", input: "Earlier decisions and commitments related to today's meetings" },
    async () => {
      const older = actionItems.filter((a) => !prevActionItems.includes(a));
      const facts = {
        todaysMeetings: today.map((m) => ({ ref: meetingRef.get(m.id), title: m.title, time: formatTime(m.startsAt), attendees: m.attendees })),
        earlierDecisions: decisions.map((d) => ({ ref: d.ref, decision: d.text, meeting: d.meeting, when: d.when })),
        openActionItems: actionItems.map((a) => ({ ref: a.ref, title: a.title, owner: a.owner, due: a.due, meeting: a.meeting })),
        memories: memories.map((m) => m.content),
      };
      const out = await narrate({
        agent: "Historian",
        phase: "Finding insights",
        tier: "heavy",
        task: "Find earlier decisions or commitments that are still pending and matter for today's meetings. Return 2 to 4 insights, each one short sentence with the ref of its source. Narrate the most important one and why it matters today (name the meeting and time).",
        facts,
        candidates: book.pick(["decision:", "action:", "meeting:"]),
        extra: { insights: z.array(z.object({ text: z.string(), ref: z.string().nullable().default(null) })).default([]) },
        extraHint: '"insights": [{ "text": string, "ref": string }]',
        maxTokens: 1200,
        fallback: () => {
          const pending = (older.length ? older : actionItems).filter((a) => a.forUser).slice(0, 3);
          const list: InsightDraft[] = pending.map((a) => {
            const related = today.find((m) => overlap(m.title, `${a.title} ${a.meeting}`).length > 0);
            return { text: `"${a.title}" from ${a.meeting} is still open${related ? ` and matters for ${related.title} at ${formatTime(related.startsAt)}` : ""}.`, ref: a.ref };
          });
          const top = pending[0];
          const related = top && today.find((m) => overlap(m.title, `${top.title} ${top.meeting}`).length > 0);
          return {
            narration: top
              ? `I also found "${top.title}" from ${top.meeting}. It's still pending${related ? `, and it matters for ${related.title} at ${formatTime(related.startsAt)}` : ""}.`
              : "I didn't find any older commitments still waiting on you.",
            found: pending.map((a) => a.ref),
            extra: { insights: list },
          };
        },
      });
      const list = out.extra.insights.filter((i) => i.text.trim()).slice(0, 4);
      return {
        ...out,
        result: list,
        handoffTo: "Courier",
        handoffSummary: describePayload([[list.length, "insight", "insights"], [userItems.length, "open item", "open items"]]),
      };
    },
    { narration: "I couldn't piece together older context this time, so I'll hand over what I have.", result: [] as InsightDraft[], handoffTo: "Courier" }
  );

  /* ---------------- 3. Courier: new and urgent mail ---------------- */
  const mailRes = await fetchEmails();
  const inbox = mailRes.rows
    .filter((e) => !e.isSent && (!e.isRead || e.receivedAt >= new Date(dayStart.getTime() - 86400000)))
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, 15);
  const emailRef = new Map<string, string>();
  inbox.forEach((e, i) => emailRef.set(e.id, book.add(`email:${i + 1}`, emailItem(e))));

  const triaged = await step(
    { agent: "Courier", phase: "Checking mail", tool: "Email", tier: "fast", input: `${inbox.length} recent emails, with Historian's context` },
    async () => {
      const facts = {
        emails: inbox.map((e) => ({ ref: emailRef.get(e.id), from: e.fromName, subject: e.subject, preview: e.body.replace(/\s+/g, " ").slice(0, 180), received: formatTime(e.receivedAt), unread: !e.isRead })),
        historianContext: [...historianInsights.map((i) => i.text), ...userItems.map((a) => `Open: ${a.title} (${a.meeting})`)],
        mailError: mailRes.error,
      };
      const out = await narrate({
        agent: "Courier",
        phase: "Checking mail",
        tier: "fast",
        task: "Triage every email as urgent, needs_reply or fyi with a one-line reason, and set linkedTo when it connects to Historian's context. Narrate how many emails are new, how many are urgent, who is asking about what, and any link to earlier context.",
        facts,
        candidates: book.pick(["email:"]),
        extra: {
          triage: z.array(z.object({ ref: z.string(), triage: z.enum(["urgent", "needs_reply", "fyi"]), reason: z.string(), linkedTo: z.string().nullable().optional() })).default([]),
        },
        extraHint: '"triage": [{ "ref": string, "triage": "urgent" | "needs_reply" | "fyi", "reason": string, "linkedTo": string | null }]',
        maxTokens: 1600,
        fallback: () => {
          const triage = inbox.map((e) => ({ ref: emailRef.get(e.id)!, ...heuristicTriage(e), linkedTo: null }));
          const urgent = triage.filter((t) => t.triage === "urgent").map((t) => inbox.find((e) => emailRef.get(e.id) === t.ref)!);
          return {
            narration: mailRes.error
              ? "I couldn't reach your mailbox, so I'll skip email for now."
              : `You have ${inbox.filter((e) => !e.isRead).length} new emails. ${urgent.length ? `${urgent.length} ${urgent.length === 1 ? "is" : "are"} urgent: ${listNames(urgent.map((e) => `${e.fromName} on "${e.subject}"`), 2)}.` : "Nothing looks urgent."}`,
            found: [...urgent.map((e) => emailRef.get(e.id)!), ...triage.filter((t) => t.triage === "needs_reply").map((t) => t.ref)],
            extra: { triage },
          };
        },
      });
      const result: Triaged[] = [];
      for (const email of inbox) {
        const ref = emailRef.get(email.id)!;
        const t = out.extra.triage.find((x) => x.ref === ref) ?? { ref, ...heuristicTriage(email), linkedTo: null };
        result.push({ email, ref, triage: t.triage, reason: t.reason, linkedTo: t.linkedTo ?? undefined });
        if (t.triage === "urgent") book.add(ref, emailItem(email, true));
        if (!email.triage) await db.update(emails).set({ triage: t.triage, triageReason: t.reason }).where(eq(emails.id, email.id));
      }
      const urgent = result.filter((r) => r.triage === "urgent").length;
      const replies = result.filter((r) => r.triage === "needs_reply").length;
      return {
        ...out,
        foundItems: out.foundItems.map((item) => ({ ...item, urgent: result.some((r) => r.triage === "urgent" && r.email.subject === item.label) })),
        result,
        handoffTo: "Tracker",
        handoffSummary: describePayload([[urgent, "urgent email", "urgent emails"], [replies, "email that needs a reply", "emails that need replies"]]),
      };
    },
    { narration: "I couldn't sort your mail this time, so I'll leave email for later.", result: [] as Triaged[], handoffTo: "Tracker" }
  );

  /* ---------------- 4. Tracker: commits, PRs and Jira ---------------- */
  const [gitRes, jiraRes] = await Promise.all([fetchGit(), fetchJira()]);
  const since = lastDay ?? new Date(dayStart.getTime() - 86400000);
  const recentGit = gitRes.rows.filter((g) => g.createdAt >= since).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 12);
  const gitRef = new Map<string, string>();
  recentGit.forEach((g, i) => gitRef.set(g.id, book.add(`${g.type === "pr" ? "pr" : "commit"}:${i + 1}`, gitItem(g))));
  const myIssues = jiraRes.rows.filter((j) => !["done", "closed"].includes(j.status.toLowerCase()));
  myIssues.forEach((j) => book.add(`jira:${j.key}`, jiraItem(j)));

  const toClose = await step(
    { agent: "Tracker", phase: "Checking dev work", tool: "GitHub, Jira", tier: "fast", input: `${recentGit.length} recent commits and PRs, ${myIssues.length} open tickets` },
    async () => {
      const commits = recentGit.filter((g) => g.type === "commit");
      const facts = {
        commits: commits.map((g) => ({ ref: gitRef.get(g.id), repo: g.repo, title: g.title, when: relativeDayLabel(g.createdAt, now) === "yesterday" ? "yesterday" : formatTime(g.createdAt) })),
        pullRequests: recentGit.filter((g) => g.type === "pr").map((g) => ({ ref: gitRef.get(g.id), repo: g.repo, title: g.title })),
        openTickets: myIssues.map((j) => ({ ref: `jira:${j.key}`, key: j.key, summary: j.summary, status: j.status, assignee: j.assignee })),
        githubError: gitRes.error,
        jiraError: jiraRes.error,
      };
      const out = await narrate({
        agent: "Tracker",
        phase: "Checking dev work",
        tier: "fast",
        task: "Summarise the user's recent commits and pull requests, and pick Jira tickets assigned to the user whose work looks finished (matching commits or PRs, status In Review or In Progress) and could be closed. Narrate the counts and which ticket looks ready to close, and say you'll draft a closing comment for them to approve. If a tool failed, say you'll skip it.",
        facts,
        candidates: book.pick(["commit:", "pr:", "jira:"]),
        extra: { ticketsToClose: z.array(z.object({ ref: z.string(), reason: z.string() })).default([]) },
        extraHint: '"ticketsToClose": [{ "ref": "jira:KEY", "reason": string }]',
        fallback: () => {
          const close = heuristicToClose(myIssues, recentGit, firstName);
          return {
            narration: [
              gitRes.error ? "I couldn't reach GitHub, so I'll skip commits for now." : `You pushed ${commits.length} commit${commits.length === 1 ? "" : "s"} ${relativeDayLabel(since, now)} and since.`,
              jiraRes.error
                ? "I couldn't reach Jira, so I'll skip tickets for now."
                : close[0]
                  ? `${close[0].issue.key} looks ready to close, so I'll draft a closing comment for you to approve.`
                  : "No tickets look ready to close yet.",
            ].join(" "),
            found: [...close.map((c) => `jira:${c.issue.key}`), ...commits.slice(0, 4).map((g) => gitRef.get(g.id)!)],
            extra: { ticketsToClose: close.map((c) => ({ ref: `jira:${c.issue.key}`, reason: c.reason })) },
          };
        },
      });
      const result: CloseCandidate[] = out.extra.ticketsToClose
        .map((t) => {
          const issue = myIssues.find((j) => `jira:${j.key}` === t.ref.trim() || j.key === t.ref.trim());
          return issue ? { issue, ref: `jira:${issue.key}`, reason: t.reason, work: workFor(issue, recentGit) } : null;
        })
        .filter((c): c is CloseCandidate => Boolean(c))
        .slice(0, 2);
      return {
        ...out,
        result,
        handoffTo: "Planner",
        handoffSummary: describePayload([[result.length, "ticket to close", "tickets to close"], [commits.length, "commit", "commits"]]),
      };
    },
    { narration: "I couldn't check your dev work this time, so I'll skip tickets for now.", result: [] as CloseCandidate[], handoffTo: "Planner" }
  );

  /* ---------------- 5. Planner: the to-do list and approvals ---------------- */
  const openTasks = await db.select().from(tasks).where(eq(tasks.status, "todo"));
  const previousPlanRuns = (await db.select({ id: agentRuns.id }).from(agentRuns).where(and(eq(agentRuns.trigger, "plan_day"), ne(agentRuns.id, runId)))).map((r) => r.id);
  // Tasks a previous plan created and the user hasn't touched get rebuilt, not duplicated.
  const replaceable = new Set(openTasks.filter((t) => t.runId && previousPlanRuns.includes(t.runId) && t.agent === "Planner").map((t) => t.id));
  const keepTasks = openTasks.filter((t) => !replaceable.has(t.id));
  keepTasks.forEach((t) => book.add(`task:${t.id.slice(0, 8)}`, { kind: "task", label: t.title, detail: t.priority }));

  const plan = await step(
    { agent: "Planner", phase: "Building your list", tool: "Tasks, Drafts", tier: "heavy", input: "Historian's open items, Courier's mail and Tracker's tickets" },
    async () => {
      const replyTo = triaged.filter((t) => t.triage !== "fyi").sort((a, b) => (a.triage === "urgent" ? 0 : 1) - (b.triage === "urgent" ? 0 : 1)).slice(0, 2);
      const alreadyQueued = await db.select().from(pendingActions).where(eq(pendingActions.status, "pending"));
      const queuedEmailIds = new Set(alreadyQueued.filter((a) => !previousPlanRuns.includes(a.runId ?? "")).map((a) => String(a.payload.emailId ?? "")));
      const queuedIssues = new Set(alreadyQueued.filter((a) => !previousPlanRuns.includes(a.runId ?? "")).map((a) => String(a.payload.issueKey ?? "")));

      const facts = {
        now: formatTime(now),
        todaysMeetings: today.map((m) => ({ title: m.title, time: formatTime(m.startsAt) })),
        insights: historianInsights.map((i) => i.text),
        openActionItemsForUser: userItems.map((a) => ({ ref: a.ref, title: a.title, due: a.due, meeting: a.meeting })),
        emails: triaged.filter((t) => t.triage !== "fyi").map((t) => ({ ref: t.ref, from: t.email.fromName, subject: t.email.subject, triage: t.triage, reason: t.reason, linkedTo: t.linkedTo })),
        ticketsToClose: toClose.map((c) => ({ ref: c.ref, key: c.issue.key, summary: c.issue.summary, reason: c.reason })),
        existingOpenTasks: keepTasks.map((t) => ({ ref: `task:${t.id.slice(0, 8)}`, title: t.title, priority: t.priority })),
      };
      const [out, replyDrafts, closingDrafts] = await Promise.all([
        narrate({
          agent: "Planner",
          phase: "Building your list",
          tier: "heavy",
          task: "Build today's to-do list, most important first, at most 8 tasks. Reuse an existing open task by giving its task ref instead of duplicating it; otherwise give the ref of the source item. Priority is urgent only for genuinely time-critical work. due is a 24h time like 10:30 when a meeting or deadline sets one, else null. Narrate that you're preparing today's list from everything the others found, and say which task goes first and why (mention the meeting it unblocks if any).",
          facts,
          candidates: book.pick(["action:", "email:", "jira:", "task:", "meeting:"]),
          extra: {
            tasks: z.array(z.object({
              title: z.string(),
              priority: z.enum(["urgent", "today"]).catch("today"),
              due: z.string().nullable().default(null),
              source: z.enum(["meeting", "email", "jira", "manual"]).catch("manual"),
              ref: z.string().nullable().default(null),
            })).default([]),
          },
          extraHint: '"tasks": [{ "title": string, "priority": "urgent" | "today", "due": "HH:MM" | null, "source": "meeting" | "email" | "jira" | "manual", "ref": string | null }]',
          maxTokens: 1600,
          fallback: () => {
            const list = heuristicPlan(userItems, triaged, toClose, keepTasks);
            return {
              narration: list[0]
                ? `I'm preparing today's list from everything the others found: ${list.length} task${list.length === 1 ? "" : "s"}. "${list[0].title}" goes first${list[0].priority === "urgent" ? " because it's urgent" : ""}.`
                : "There's nothing new to add to today's list.",
              found: [],
              extra: { tasks: list },
            };
          },
        }),
        // Drafts need the model; without it the replies stay on the list instead.
        hasApiKey() ? Promise.all(replyTo.filter((t) => !queuedEmailIds.has(t.email.id)).map((t) => draftReply(t, settings.toneDefault))) : [null],
        hasApiKey() ? Promise.all(toClose.filter((c) => !queuedIssues.has(c.issue.key)).map(draftClosing)) : [],
      ]);

      // Persist: previous plan's untouched items are superseded by this run.
      if (previousPlanRuns.length) {
        await db.delete(pendingActions).where(and(eq(pendingActions.status, "pending"), inArray(pendingActions.runId, previousPlanRuns)));
      }
      if (replaceable.size) await db.delete(tasks).where(inArray(tasks.id, [...replaceable]));

      const created: FoundItem[] = [];
      const planned = out.extra.tasks.filter((t) => t.title.trim()).slice(0, 8);
      for (const [index, t] of planned.entries()) {
        const existing = t.ref?.startsWith("task:") ? keepTasks.find((k) => `task:${k.id.slice(0, 8)}` === t.ref) : undefined;
        const due = parseDue(t.due, dayStart);
        if (existing) {
          await db.update(tasks).set({ priority: t.priority, sortOrder: index, due: due ?? existing.due }).where(eq(tasks.id, existing.id));
        } else {
          await db.insert(tasks).values({
            title: t.title,
            priority: t.priority,
            due,
            source: t.source as TaskSource,
            sourceId: t.ref,
            runId,
            agent: "Planner",
            sortOrder: index,
          });
        }
        created.push({ kind: "task", label: t.title, detail: [t.due, t.priority === "urgent" ? "urgent" : null].filter(Boolean).join(" · ") || undefined, urgent: t.priority === "urgent" });
      }
      // Anything the plan didn't mention keeps its place after the plan.
      for (const [index, t] of keepTasks.filter((k) => !planned.some((p) => p.ref === `task:${k.id.slice(0, 8)}`)).entries()) {
        await db.update(tasks).set({ sortOrder: planned.length + index }).where(eq(tasks.id, t.id));
      }

      const approvals: FoundItem[] = [];
      for (const d of [...replyDrafts, ...closingDrafts]) {
        if (!d) continue;
        const [draft] = await db.insert(drafts).values({ kind: d.kind, targetType: d.targetType, targetId: d.targetId, content: d.content, tone: settings.toneDefault, runId }).returning({ id: drafts.id });
        await queueAction({ actionType: d.actionType, summary: d.summary, payload: d.payload, draftId: draft.id, runId, reason: d.reason });
        approvals.push({ kind: "draft", label: d.summary, detail: "Waiting for your OK" });
      }
      const draftsFailed = replyTo.length + toClose.length > 0 && approvals.length === 0 && [...replyDrafts, ...closingDrafts].some((d) => d === null);
      return {
        narration: draftsFailed ? `${out.narration} I couldn't write the drafts just now, so the replies are on your list instead.` : out.narration,
        foundItems: [...created.slice(0, 4), ...approvals],
        modelUsed: out.modelUsed,
        result: { tasks: created, approvals },
        handoffTo: "Nudge",
        handoffSummary: describePayload([[created.length, "task", "tasks"], [approvals.length, "draft for your OK", "drafts for your OK"]]),
      };
    },
    { narration: "I couldn't build the list this time, so your existing tasks stay as they were.", result: { tasks: [] as FoundItem[], approvals: [] as FoundItem[] }, handoffTo: "Nudge" }
  );

  /* ---------------- 6. Nudge: insights and wrap-up ---------------- */
  const summary = await step(
    { agent: "Nudge", phase: "Wrapping up", tool: "Memory", tier: "heavy", input: "Everything the crew found" },
    async () => {
      const urgentMail = triaged.filter((t) => t.triage === "urgent");
      const facts = {
        historianInsights: historianInsights,
        urgentEmails: urgentMail.map((t) => ({ ref: t.ref, from: t.email.fromName, subject: t.email.subject, reason: t.reason, linkedTo: t.linkedTo })),
        ticketsToClose: toClose.map((c) => ({ ref: c.ref, key: c.issue.key, reason: c.reason })),
        topTasks: plan.tasks.slice(0, 4).map((t) => t.label),
        approvalsWaiting: plan.approvals.map((a) => a.label),
        todaysMeetings: today.map((m) => ({ ref: meetingRef.get(m.id), title: m.title, time: formatTime(m.startsAt) })),
      };
      const out = await narrate({
        agent: "Nudge",
        phase: "Wrapping up",
        tier: "heavy",
        task: "Write 3 to 5 insights: the key takeaways for today, each one plain sentence with the ref of its source. Also write a one-line summary of the day. Narrate a very short wrap-up saying the plan is ready (one sentence is fine).",
        facts,
        candidates: book.all(),
        extra: {
          insights: z.array(z.object({ text: z.string(), ref: z.string().nullable().default(null) })).default([]),
          summary: z.string().default(""),
        },
        extraHint: '"insights": [{ "text": string, "ref": string }], "summary": string',
        maxTokens: 1200,
        fallback: () => {
          const list: InsightDraft[] = [
            ...historianInsights,
            ...urgentMail.slice(0, 2).map((t) => ({ text: `${t.email.fromName} needs a reply on "${t.email.subject}".`, ref: t.ref })),
            ...toClose.slice(0, 1).map((c) => ({ text: `${c.issue.key} looks ready to close.`, ref: c.ref })),
          ].slice(0, 5);
          return {
            narration: `Done. Here's your day: ${plan.tasks.length} task${plan.tasks.length === 1 ? "" : "s"}${plan.approvals.length ? ` and ${plan.approvals.length} thing${plan.approvals.length === 1 ? "" : "s"} waiting for your OK` : ""}.`,
            found: [],
            extra: { insights: list, summary: `${plan.tasks.length} tasks, ${urgentMail.length} urgent emails, ${plan.approvals.length} approvals` },
          };
        },
      });
      const list = (out.extra.insights.length ? out.extra.insights : historianInsights).filter((i) => i.text.trim()).slice(0, 5);
      await db.delete(insights).where(eq(insights.runId, runId));
      for (const [index, insight] of list.entries()) {
        const source = insight.ref ? book.get(insight.ref.trim()) : undefined;
        await db.insert(insights).values({ runId, text: insight.text, sourceType: source?.kind, sourceLabel: source?.label, href: source?.href, sortOrder: index });
      }
      return { ...out, foundItems: [], result: out.extra.summary || out.narration };
    },
    { narration: "I couldn't write up the takeaways, but your list and approvals are ready below.", result: "" }
  );

  await logActivity({ action: "Nudge planned your day", summary: summary || "Today's plan is ready", entityType: "agent_run", entityId: runId });
  await finishRun(runId, plan.approvals.length ? "waiting_for_user" : "done", summary);
}

/* ------------------------------------------------------------------ */
/* Drafts (heavy tier, run in parallel with the plan)                  */
/* ------------------------------------------------------------------ */
type QueuedDraft = {
  kind: "email_reply" | "jira_comment";
  targetType: string;
  targetId: string;
  content: string;
  actionType: "send_email" | "post_jira_comment";
  summary: string;
  payload: Record<string, unknown>;
  reason: string;
};

async function draftReply(t: Triaged, tone: string): Promise<QueuedDraft | null> {
  try {
    const reply = await runSkill(emailReplyDraftSkill, {
      fromName: t.email.fromName,
      subject: t.email.subject,
      body: t.email.body,
      tone,
      instruction: t.linkedTo ? `Keep in mind: ${t.linkedTo}` : undefined,
    });
    return {
      kind: "email_reply",
      targetType: "email",
      targetId: t.email.id,
      content: JSON.stringify(reply),
      actionType: "send_email",
      summary: `Reply to ${t.email.fromName}: ${t.email.subject}`,
      payload: { emailId: t.email.id, to: t.email.fromEmail, subject: reply.subject, body: reply.body },
      reason: t.reason,
    };
  } catch (error) {
    console.error("Reply draft failed", error);
    return null;
  }
}

async function draftClosing(c: CloseCandidate): Promise<QueuedDraft | null> {
  try {
    const out = await runSkill(jiraClosingCommentSkill, { key: c.issue.key, summary: c.issue.summary, status: c.issue.status, recentWork: c.work });
    return {
      kind: "jira_comment",
      targetType: "jira",
      targetId: c.issue.key,
      content: JSON.stringify({ body: out.comment }),
      actionType: "post_jira_comment",
      summary: `Close ${c.issue.key}: ${c.issue.summary}`,
      payload: { issueKey: c.issue.key, comment: out.comment, body: out.comment, toStatus: out.suggestedTransition },
      reason: c.reason,
    };
  } catch (error) {
    console.error("Closing comment failed", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Data-only fallbacks (used when the model is unavailable)            */
/* ------------------------------------------------------------------ */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function heuristicTriage(e: Email): { triage: "urgent" | "needs_reply" | "fyi"; reason: string } {
  if (e.triage) return { triage: e.triage, reason: e.triageReason ?? "Triaged earlier." };
  const text = `${e.subject} ${e.body}`.toLowerCase();
  if (/no-?reply|notifications@|digest@|newsletter|billing/.test(e.fromEmail.toLowerCase())) return { triage: "fyi", reason: "Automated notification." };
  if (/urgent|asap|blocked|is down|need it|tomorrow|short notice|before (our|the|today)|by \d{1,2}[:.]\d{2}/.test(text)) return { triage: "urgent", reason: "Mentions a deadline or a blocker." };
  if (/\?/.test(text)) return { triage: "needs_reply", reason: "Asks you a question." };
  return { triage: "fyi", reason: "No reply needed." };
}

function workFor(issue: JiraIssue, git: { title: string; repo: string; type: string }[]) {
  return git.filter((g) => overlap(g.title, issue.summary).length > 0).map((g) => `${g.type === "pr" ? "PR" : "Commit"} in ${g.repo}: ${g.title}`);
}

function heuristicToClose(issues: JiraIssue[], git: { title: string; repo: string; type: string }[], firstName: string): CloseCandidate[] {
  return issues
    .filter((j) => /review|progress/i.test(j.status) && (j.assignee ?? "").toLowerCase().includes(firstName))
    .map((issue) => ({ issue, work: workFor(issue, git) }))
    .filter((c) => c.work.some((w) => w.startsWith("PR")) || (c.issue.status.toLowerCase().includes("review") && c.work.length > 0))
    .map((c) => ({ ...c, ref: `jira:${c.issue.key}`, reason: `${c.work.length} related commit${c.work.length === 1 ? "" : "s"} or PRs, status ${c.issue.status}.` }))
    .slice(0, 1);
}

function heuristicPlan(items: ActionItem[], mail: Triaged[], close: CloseCandidate[], keep: { id: string; title: string; priority: string }[]) {
  type Planned = { title: string; priority: "urgent" | "today"; due: string | null; source: "meeting" | "email" | "jira" | "manual"; ref: string | null };
  const out: Planned[] = [
    ...mail.filter((t) => t.triage === "urgent").map((t) => ({ title: `Reply to ${t.email.fromName} about "${t.email.subject}"`, priority: "urgent" as const, due: null, source: "email" as const, ref: t.ref })),
    ...keep.filter((t) => t.priority === "urgent").map((t) => ({ title: t.title, priority: "urgent" as const, due: null, source: "manual" as const, ref: `task:${t.id.slice(0, 8)}` })),
    ...items.filter((a) => a.dueToday).map((a) => ({ title: a.title, priority: "today" as const, due: null, source: "meeting" as const, ref: a.ref })),
    ...close.map((c) => ({ title: `Approve the closing comment for ${c.issue.key}`, priority: "today" as const, due: null, source: "jira" as const, ref: c.ref })),
    ...items.filter((a) => !a.dueToday).map((a) => ({ title: a.title, priority: "today" as const, due: null, source: "meeting" as const, ref: a.ref })),
  ];
  const seen = new Set<string>();
  return out.filter((t) => !seen.has(t.title.toLowerCase()) && seen.add(t.title.toLowerCase())).slice(0, 8);
}

function parseDue(due: string | null, dayStart: Date) {
  const match = due?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const d = new Date(dayStart);
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */
export async function startPlanDay() {
  const running = await db.select({ id: agentRuns.id, startedAt: agentRuns.startedAt }).from(agentRuns)
    .where(and(eq(agentRuns.trigger, "plan_day"), eq(agentRuns.status, "running"))).get();
  if (running && running.startedAt && Date.now() - running.startedAt.getTime() < 5 * 60 * 1000) return { runId: running.id, started: false };
  if (running) await finishRun(running.id, "failed");
  const runId = await createRun("plan_day", "Plan my day");
  void runPlanDay(runId).catch(async (error) => {
    console.error("plan_day failed", error);
    await finishRun(runId, "failed");
  });
  return { runId, started: true };
}
