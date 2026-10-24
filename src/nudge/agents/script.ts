import { z } from "zod";
import type { Briefing } from "@/nudge/briefing";
import { STANDUP_CHANNEL } from "@/nudge/briefing";
import { SceneScriptSchema, type BriefingAnswers, type Scene, type SceneId, type SceneScript } from "@/nudge/scenes";
import type { AgentName } from "@/nudge/types";
import fallbackJSON from "../../../demo/fallback-script.json";
import { firstName, planSentence } from "./analysis";
import { modelJSON, VOICE_RULES } from "./model";
import { safeZone, spokenTime } from "./time";

export const SCRIPT_TIMEOUT_MS = 8000;

const OWNER: Record<SceneId, AgentName> = {
  welcome: "Nudge",
  team: "Nudge",
  catch: "Tracker",
  picks: "Planner",
  plan: "Planner",
  standup: "Reporter",
  post: "Reporter",
  inbox: "Courier",
  wrapup: "Nudge",
};

/** Scenes this briefing needs, in order: no mismatch → no catch, no urgent email → no inbox. */
export function sceneIdsFor(b: Briefing): SceneId[] {
  return (["welcome", "team", "catch", "picks", "plan", "standup", "post", "inbox", "wrapup"] as SceneId[]).filter(
    (id) => (id !== "catch" || b.mismatch) && (id !== "inbox" || b.inbox) && (id !== "picks" || b.picks.length) && (id !== "plan" || b.picks.length)
  );
}

const highlights = (speech: string, terms: (string | undefined | null)[]) =>
  [...new Set(terms.filter((t): t is string => Boolean(t) && t!.length > 1 && speech.includes(t!)))];

/** The short label a choice option shows: the ticket title, trimmed. */
export const optionLabel = (title: string) => (title.length > 40 ? `${title.slice(0, 38).trimEnd()}…` : title);

/**
 * Deterministic scene script built from the real briefing. Used when the model is
 * unavailable, invalid or slow, and as the skeleton the model's lines are merged into.
 */
export function buildTemplateScript(b: Briefing, answers?: BriefingAnswers, tz?: string): SceneScript {
  const zone = safeZone(tz);
  const scenes: Scene[] = [];
  const add = (id: SceneId, speech: string, terms: (string | undefined | null)[], reveals: Scene["reveals"], interaction?: Scene["interaction"]) =>
    scenes.push({ id, agent: OWNER[id], speech, captionHighlights: highlights(speech, terms), reveals, ...(interaction ? { interaction } : {}) });

  for (const id of sceneIdsFor(b)) {
    if (id === "welcome") add(id, `Morning, ${b.userName}. Ready to start your day?`, [b.userName], [{ section: "welcome" }]);
    if (id === "team") add(id, "Give me a moment while my team looks through your day.", [], [{ section: "graph" }]);
    if (id === "catch" && b.mismatch) {
      const m = b.mismatch;
      add(
        id,
        `You opened PR ${m.pr.number} for ${m.ticket.key}, but the ticket still says ${m.ticket.status}. Want me to move it to ${m.suggestedStatus}?`,
        [`PR ${m.pr.number}`, m.ticket.key, m.ticket.status, m.suggestedStatus],
        [{ section: "catch", itemIds: [m.ticket.key] }],
        { type: "confirm", pendingActionId: m.pendingActionId }
      );
    }
    if (id === "picks") {
      const why = b.picks.map((p) => `${p.id} ${shortWhy(p)}`);
      const speech = `I'd pick from these ${NUMBER_WORDS[b.picks.length] ?? b.picks.length} today. ${listSentence(why)}. Which one first?`;
      const people = b.picks.map((p) => p.reason.match(/Unblocks (\w+)/)?.[1]);
      add(id, speech, [...b.picks.map((p) => p.id), ...people], [{ section: "picks", itemIds: b.picks.map((p) => p.id) }], {
        type: "choice",
        options: b.picks.map((p) => ({ id: p.id, label: optionLabel(p.ticket.title) })),
      });
    }
    if (id === "plan") {
      const speech = answers?.planSpeech ?? planSentence(b.plan, answers?.pick?.choiceId ?? b.picks[0].id, zone, b.picks);
      add(id, speech, [...b.picks.map((p) => p.id), ...b.events.map((e) => spokenTime(e.start, zone))], [{ section: "plan", itemIds: b.plan.filter((p) => p.ticketKey).map((p) => p.ticketKey!) }]);
    }
    if (id === "standup") {
      const s = b.standup;
      add(
        id,
        `Here's your standup: ${s.yesterday.length} point${s.yesterday.length === 1 ? "" : "s"} for yesterday, ${s.today.length} for today${s.blockers.length ? `, ${s.blockers.length} blocker${s.blockers.length === 1 ? "" : "s"}` : ", no blockers"}. Anything you want to change?`,
        [`${s.yesterday.length} point${s.yesterday.length === 1 ? "" : "s"}`, `${s.today.length} for today`],
        [{ section: "standup" }],
        { type: "edit" }
      );
    }
    if (id === "post")
      add(id, `Post this to ${STANDUP_CHANNEL.replace("#", "")}?`, [STANDUP_CHANNEL.replace("#", "")], [{ section: "post" }], {
        type: "confirm",
        ...(b.standupActionId ? { pendingActionId: b.standupActionId } : {}),
      });
    if (id === "inbox" && b.inbox) {
      const e = b.inbox.email;
      add(
        id,
        `One more thing: ${firstName(e.from)} emailed: ${e.subject.replace(/^((re|fwd?|urgent):\s*)+/i, "").replace(/[.!?]+$/, "")}. I've drafted a reply saying you're on it. It's waiting for your OK.`,
        [firstName(e.from), e.linkedTicket],
        [{ section: "inbox", itemIds: [e.id] }]
      );
    }
    if (id === "wrapup") {
      const first = answers?.pick?.choiceId ?? b.picks[0]?.id;
      add(id, `That's your day${first ? `, starting with ${first}` : ""}. I'm here if anything changes.`, [first], [{ section: "wrapup" }]);
    }
  }
  return { scenes };
}

/** "NUD-150 is due today with a customer escalation": a short spoken clause per pick. */
function shortWhy(p: Briefing["picks"][number]) {
  const t = p.tags;
  if (t.includes("due_today") && t.includes("escalation")) return "is due today with a customer escalation";
  if (t.includes("escalation")) return "has a customer escalation";
  if (t.includes("unblocks")) return `unblocks ${p.reason.match(/Unblocks (\w+)/)?.[1] ?? "a teammate"}`;
  if (t.includes("due_today")) return "is due today";
  const fits = p.reason.match(/fits before your (.+)$/)?.[1];
  if (t.includes("fits_window")) return fits ? `fits before your ${fits}` : "fits your free window";
  return `is ${p.ticket.priority}`;
}

const NUMBER_WORDS = ["no", "one", "two", "three"];

function listSentence(items: string[]) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (items.length <= 1) return cap(items[0] ?? "");
  return cap(`${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`);
}

/* ------------------------------ Model script ------------------------------ */

const ModelScenesSchema = (ids: SceneId[]) =>
  z
    .object({ scenes: z.array(z.object({ id: z.string(), speech: z.string().min(3).max(320), captionHighlights: z.array(z.string()).default([]) })) })
    .refine((s) => s.scenes.length === ids.length && s.scenes.every((scene, i) => scene.id === ids[i]), { message: `scenes must be exactly ${ids.join(", ")} in order` });

/**
 * One heavy-tier call writes every spoken line from the briefing; structure (owner,
 * reveals, interactions, action ids) always comes from the template so it stays valid.
 */
export async function generateSceneScript(b: Briefing, opts: { demo: boolean; tz?: string }) {
  const template = buildTemplateScript(b, undefined, opts.tz);
  const ids = template.scenes.map((s) => s.id as SceneId);
  const zone = safeZone(opts.tz);
  const out = await modelJSON(
    {
      tier: "heavy",
      timeoutMs: SCRIPT_TIMEOUT_MS,
      maxTokens: 1400,
      system: [
        "You are Nudge, a voice assistant briefing a developer on their day. Write the spoken line for each scene.",
        VOICE_RULES,
        "Each speech is 1 to 3 short sentences, first person, under 45 words. captionHighlights lists the exact ticket keys, names and counts that appear in that speech.",
        `Return {"scenes":[{"id","speech","captionHighlights"}]} with exactly these ids in order: ${ids.join(", ")}.`,
        "Scene jobs: welcome greets by first name and asks if they're ready; team says the agents are looking through the day; catch names the PR and ticket mismatch and asks to move it; picks names the three tickets with their reasons and asks which first; plan explains where the first pick fits in the calendar; standup says the draft is ready and asks for changes; post asks to post it to team-standup; inbox mentions the urgent email in one sentence and that a reply waits for OK; wrapup closes briefly.",
      ].join("\n"),
      user: JSON.stringify({
        user: b.userName,
        mismatch: b.mismatch && { pr: b.mismatch.pr.number, prTitle: b.mismatch.pr.title, ticket: b.mismatch.ticket.key, status: b.mismatch.ticket.status, suggested: b.mismatch.suggestedStatus },
        picks: b.picks.map((p) => ({ key: p.id, title: p.ticket.title, reason: p.reason })),
        calendar: b.events.map((e) => ({ title: e.title, start: spokenTime(e.start, zone), end: spokenTime(e.end, zone) })),
        plan: b.plan.filter((p) => p.kind !== "free").map((p) => ({ title: p.ticketKey ?? p.title, start: spokenTime(p.start, zone), end: spokenTime(p.end, zone) })),
        standup: b.standup,
        inbox: b.inbox && { from: b.inbox.email.from, subject: b.inbox.email.subject, ticket: b.inbox.email.linkedTicket },
        templateLines: template.scenes.map((s) => ({ id: s.id, speech: s.speech })),
      }),
      schema: ModelScenesSchema(ids),
    },
    () => null
  );
  if (!out.value) return { script: template, source: "template" as const, modelUsed: false };
  const script: SceneScript = {
    scenes: template.scenes.map((scene, i) => {
      const line = out.value!.scenes[i];
      return { ...scene, speech: line.speech.trim(), captionHighlights: [...new Set(line.captionHighlights.filter((h) => h && line.speech.includes(h)))] };
    }),
  };
  const parsed = SceneScriptSchema.safeParse(script);
  return parsed.success ? { script: parsed.data, source: "model" as const, modelUsed: true } : { script: template, source: "template" as const, modelUsed: false };
}

/* ------------------------------ Demo fallback ------------------------------ */

export const FALLBACK_PLACEHOLDERS = { catch: "{{catchActionId}}", post: "{{postActionId}}" } as const;

/** The committed demo/fallback-script.json with this session's action ids substituted (or dropped). */
export function loadFallbackScript(ids: { catchActionId?: string | null; postActionId?: string | null }): SceneScript | null {
  const parsed = SceneScriptSchema.safeParse(fallbackJSON);
  if (!parsed.success) return null;
  const fill = (v: string | undefined) =>
    v === FALLBACK_PLACEHOLDERS.catch ? ids.catchActionId ?? undefined : v === FALLBACK_PLACEHOLDERS.post ? ids.postActionId ?? undefined : v;
  return {
    scenes: parsed.data.scenes.map((s) => {
      if (!s.interaction) return s;
      const pendingActionId = fill(s.interaction.pendingActionId);
      const { pendingActionId: _drop, ...rest } = s.interaction;
      void _drop;
      return { ...s, interaction: pendingActionId ? { ...rest, pendingActionId } : rest };
    }),
  };
}
