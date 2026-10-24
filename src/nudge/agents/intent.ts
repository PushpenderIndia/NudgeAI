import { IntentSchema, type Intent, type Interaction } from "@/nudge/scenes";
import { modelJSON } from "./model";

const CONFIRM = /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|please do|please|approve|approved|confirm|sounds good|go for it|move it|post it|send it|absolutely|of course|correct|right)\b/;
const DECLINE = /^(no|nope|nah|not now|not yet|skip|later|don'?t|do not|cancel|leave it|never mind|hold off|stop)\b/;
const DONE = /^(looks good|look good|that'?s fine|that'?s good|fine|good|great|perfect|done|post it|ship it|all good|no changes?|nothing|no|nope|lgtm|that'?s it|it'?s fine|it'?s good|keep it)\b/;
const EDIT = /^(remove|delete|drop|take out|cut|get rid of|add|also add|also|mention|include|put|change|replace|update|edit|rewrite|say)\b/;
const ORDINALS: [RegExp, number][] = [
  [/\b(first|1st|number one|number 1|top)\b|#1\b|^(1|one)$/, 0],
  [/\b(second|2nd|number two|number 2|middle)\b|#2\b|^(2|two)$/, 1],
  [/\b(third|3rd|number three|number 3)\b|#3\b|^(3|three)$/, 2],
];
const STOP = new Set("the a an one that this it i want to do pick choose go with take lets let's start please on first".split(" "));

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9#'\-/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const stem = (w: string) => w.replace(/(ing|es|s)$/, "");
const tokens = (s: string) => normalize(s).split(/[\s/]+/).filter((w) => w && !STOP.has(w)).map(stem);

function matchOption(text: string, options: NonNullable<Interaction["options"]>) {
  const key = text.match(/\b([a-z]+-?\d+)\b/)?.[1]?.replace(/^([a-z]+)(\d)/, "$1-$2");
  const byKey = key && options.find((o) => o.id.toLowerCase() === key || o.id.toLowerCase().endsWith(`-${key.replace(/\D/g, "")}`));
  if (byKey) return byKey.id;
  const num = text.match(/\b(\d{2,})\b/)?.[1];
  const byNum = num && options.find((o) => o.id.endsWith(`-${num}`) || o.label.includes(`#${num}`));
  if (byNum) return byNum.id;
  const said = tokens(text);
  const scored = options
    .map((o) => {
      const have = tokens(`${o.label} ${o.id}`);
      return { id: o.id, score: said.filter((w) => w.length > 2 && have.some((h) => h === w || (w.length > 3 && h.startsWith(w)))).length };
    })
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score && scored[0].score > (scored[1]?.score ?? 0)) return scored[0].id;
  for (const [re, i] of ORDINALS) if (re.test(text) && options[i]) return options[i].id;
  if (/\blast\b/.test(text) && options.length) return options[options.length - 1].id;
  return null;
}

/** Deterministic first pass; null means "ambiguous, ask the fast model". */
export function preParseIntent(transcript: string, interaction: Interaction): Intent | null {
  const text = normalize(transcript);
  if (!text) return { intent: "unknown" };
  if (interaction.type === "confirm") {
    if (DECLINE.test(text)) return { intent: "decline" };
    if (CONFIRM.test(text)) return { intent: "confirm" };
    return null;
  }
  if (interaction.type === "choice") {
    const id = matchOption(text, interaction.options ?? []);
    return id ? { intent: "choose", choiceId: id } : null;
  }
  if (EDIT.test(text)) return { intent: "edit", editInstruction: transcript.trim() };
  if (DONE.test(text)) return { intent: "done" };
  return null;
}

/** Transcript (spoken or typed) → intent; fast-tier model only when the pre-parser can't tell. */
export async function parseIntent(transcript: string, interaction: Interaction): Promise<Intent> {
  const quick = preParseIntent(transcript, interaction);
  if (quick) return quick;
  const allowed =
    interaction.type === "confirm" ? "confirm | decline | unknown" : interaction.type === "choice" ? "choose (with choiceId) | unknown" : "edit (with editInstruction) | done | unknown";
  const out = await modelJSON(
    {
      tier: "fast",
      timeoutMs: 4000,
      maxTokens: 120,
      system: `Classify what the user said in reply to a voice assistant. The assistant is waiting for: ${interaction.type}. Allowed intents: ${allowed}. For choose, choiceId must be one of the option ids. For edit, editInstruction restates the change in a few words. Return {"intent": ..., "choiceId"?: ..., "editInstruction"?: ...}.`,
      user: JSON.stringify({ said: transcript, options: interaction.options ?? [] }),
      schema: IntentSchema,
    },
    () => ({ intent: "unknown" as const })
  );
  const intent = out.value;
  if (intent.intent === "choose" && !(interaction.options ?? []).some((o) => o.id === intent.choiceId)) return { intent: "unknown" };
  if (intent.intent === "edit" && !intent.editInstruction) return { intent: "edit", editInstruction: transcript.trim() };
  return intent;
}
