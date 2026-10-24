import { IntentSchema, type BriefingAnswers, type Intent, type Interaction, type Scene } from "@/nudge/scenes";

export type Via = "voice" | "click" | "text";
export type RespondInput = { kind: "click"; optionId: string } | { kind: "text" | "voice"; transcript: string };
export type InteractionOption = { id: string; label: string };

const CONFIRM_OPTIONS: InteractionOption[] = [
  { id: "confirm", label: "Yes" },
  { id: "decline", label: "Not now" },
];

/** Buttons for an interaction. Confirm uses its own options when given, else Yes / Not now. */
export function interactionOptions(interaction: Interaction): InteractionOption[] {
  if (interaction.type === "confirm") return interaction.options?.length ? interaction.options : CONFIRM_OPTIONS;
  if (interaction.type === "choice") return interaction.options ?? [];
  return [{ id: "done", label: "Looks good" }];
}

/** The button Enter presses: confirm → "confirm", choice → first option, edit → "done". */
export function defaultOptionId(interaction: Interaction): string | undefined {
  if (interaction.type === "confirm") return "confirm";
  if (interaction.type === "choice") return interaction.options?.[0]?.id;
  return "done";
}

/** What Skip applies. Never approves: confirm → decline, choice → first option, edit → done. */
export function safeDefaultIntent(interaction: Interaction): Intent {
  if (interaction.type === "confirm") return { intent: "decline" };
  if (interaction.type === "choice") {
    const first = interaction.options?.[0]?.id;
    return first ? { intent: "choose", choiceId: first } : { intent: "unknown" };
  }
  return { intent: "done" };
}

const APPROVE_IDS = new Set(["confirm", "yes", "approve", "ok"]);

export function intentFromOption(interaction: Interaction, optionId: string): Intent {
  if (interaction.type === "confirm") return { intent: APPROVE_IDS.has(optionId) ? "confirm" : "decline" };
  if (interaction.type === "choice") return { intent: "choose", choiceId: optionId };
  return { intent: "done" };
}

/** Coerces an intent to one this interaction accepts; anything else becomes unknown. */
export function normalizeIntent(intent: Intent, interaction: Interaction): Intent {
  const unknown: Intent = { intent: "unknown" };
  if (interaction.type === "confirm") return intent.intent === "confirm" || intent.intent === "decline" ? { intent: intent.intent } : unknown;
  if (interaction.type === "choice") {
    const ids = (interaction.options ?? []).map((o) => o.id);
    return intent.intent === "choose" && intent.choiceId && ids.includes(intent.choiceId) ? { intent: "choose", choiceId: intent.choiceId } : unknown;
  }
  if (intent.intent === "edit" && intent.editInstruction?.trim()) return { intent: "edit", editInstruction: intent.editInstruction.trim() };
  if (intent.intent === "done" || intent.intent === "confirm" || intent.intent === "decline") return { intent: "done" };
  return unknown;
}

const DONE = /\b(looks? (good|great|fine|right)|all good|that'?s (good|fine|great|it|perfect)|perfect|no changes?|nothing( else)?|it'?s fine|fine as is|ship it|lgtm|done|keep it|leave it as is)\b/;
const DECLINE = /\b(no|nope|nah|not now|not yet|later|skip|don'?t|do not|cancel|leave it|hold off|never ?mind)\b/;
const CONFIRM = /\b(yes|yeah|yep|yup|sure|ok(ay)?|do it|go ahead|go for it|please|confirm|approve|sounds good|post it|send it|move it|correct|right)\b/;
const EDIT_VERB = /\b(remove|delete|drop|add|change|replace|mention|say|rewrite|shorten|include|put|swap|take out|cut|make)\b/;
const ORDINALS: [RegExp, number][] = [
  [/\b(first|1st|number one|number 1|top)\b/, 0],
  [/\b(second|2nd|two|number 2|middle)\b/, 1],
  [/\b(third|3rd|three|number 3)\b/, 2],
  [/\b(fourth|4th|four)\b/, 3],
];
const STOP = new Set(["the", "a", "an", "one", "that", "this", "with", "for", "and", "from", "pick", "take", "let's", "lets", "do", "go"]);

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#\-' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Deterministic parser used when the intent endpoint is unreachable. */
export function localIntent(transcript: string, interaction: Interaction): Intent {
  const text = transcript.toLowerCase().trim();
  if (!text) return { intent: "unknown" };

  if (interaction.type === "confirm") {
    if (DECLINE.test(text)) return { intent: "decline" };
    if (CONFIRM.test(text)) return { intent: "confirm" };
    return { intent: "unknown" };
  }

  if (interaction.type === "choice") {
    const options = interaction.options ?? [];
    if (/\blast\b/.test(text) && options.length) return { intent: "choose", choiceId: options[options.length - 1].id };
    const said = new Set(words(text));
    let best: { id: string; score: number } | null = null;
    for (const option of options) {
      const label = `${option.label} ${option.id}`.toLowerCase();
      const score = words(label).filter((w) => said.has(w) || (w.length > 4 && text.includes(w.slice(0, -1)))).length;
      if (score > 0 && (!best || score > best.score)) best = { id: option.id, score };
    }
    if (best) return { intent: "choose", choiceId: best.id };
    for (const [re, i] of ORDINALS) if (re.test(text) && options[i]) return { intent: "choose", choiceId: options[i].id };
    if (/^(the )?one\b/.test(text) && options[0]) return { intent: "choose", choiceId: options[0].id };
    return { intent: "unknown" };
  }

  if (EDIT_VERB.test(text) && text.split(/\s+/).length >= 2) return { intent: "edit", editInstruction: transcript.trim() };
  if (DONE.test(text) || CONFIRM.test(text) || /^(no|nope|nah)\b/.test(text)) return { intent: "done" };
  if (text.split(/\s+/).length >= 3) return { intent: "edit", editInstruction: transcript.trim() };
  return { intent: "unknown" };
}

/**
 * Parses a spoken or typed reply via POST /api/briefing/intent, falling back to the local
 * parser on timeout, error, invalid JSON or an unknown answer, so the flow never dead-ends.
 */
export async function parseIntent(
  transcript: string,
  interaction: Interaction,
  { endpoint = "/api/briefing/intent", timeoutMs = 6000 }: { endpoint?: string; timeoutMs?: number } = {}
): Promise<Intent> {
  const local = normalizeIntent(localIntent(transcript, interaction), interaction);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, interaction }),
      signal: controller.signal,
    });
    if (!res.ok) return local;
    const parsed = IntentSchema.safeParse(await res.json());
    if (!parsed.success) return local;
    const remote = normalizeIntent(parsed.data, interaction);
    return remote.intent === "unknown" ? local : remote;
  } catch {
    return local;
  } finally {
    clearTimeout(timer);
  }
}

export type ReplayStep = { intent: Intent; via: Via };

/** Saved answers for a scene, in order, or null when nothing was saved for it. */
export function answersToIntents(scene: Scene, answers: BriefingAnswers): ReplayStep[] | null {
  const interaction = scene.interaction;
  if (!interaction) return null;
  if (interaction.type === "confirm") {
    const answer = scene.id === "post" ? answers.post : scene.id === "catch" ? answers.catch : undefined;
    return answer ? [{ intent: { intent: answer.decision }, via: answer.via }] : null;
  }
  if (interaction.type === "choice") {
    return answers.pick ? [{ intent: { intent: "choose", choiceId: answers.pick.choiceId }, via: answers.pick.via }] : null;
  }
  if (!answers.standupEdits && !answers.standupFinal) return null;
  return [
    ...(answers.standupEdits ?? []).map((edit) => ({
      intent: { intent: "edit", editInstruction: edit.instruction } satisfies Intent,
      via: "voice" as Via,
    })),
    { intent: { intent: "done" }, via: "click" },
  ];
}
