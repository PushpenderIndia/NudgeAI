import { z } from "zod";
import type { FoundItem } from "@/db/schema";
import { completeJSON, hasApiKey } from "@/ai/client";
import type { AgentName, Tier } from "./runs";

/** Something the agent may cite as "found", keyed by a short ref the model copies back. */
export type Candidate = { ref: string; item: FoundItem };

type NarrateResult<X> = {
  narration: string;
  foundItems: FoundItem[];
  extra: X;
  modelUsed: boolean;
  error?: string;
};

const SYSTEM = (agent: AgentName) =>
  [
    `You are ${agent}, one of the specialist agents inside Nudge, a private office assistant.`,
    "You are telling the user, a colleague, what you just did while planning their day.",
    'Rules for "narration": first person, one or two short sentences, plain and specific.',
    "Name the real meetings, people, emails and tickets from the data. Say what you found and what happens next.",
    "No hype, no emoji, no exclamation marks, never mention AI or models. Use only facts present in the data.",
    "If the data is empty or a tool failed, say so honestly and say what you will do instead.",
    'Rules for "found": copy refs exactly from the candidate list for the items you relied on, most important first, at most 6.',
  ].join("\n");

/**
 * One model call per step: the agent sees the data it actually fetched and returns a
 * short first-person narration, the refs it relied on, and any structured output the
 * step needs. Refs are resolved against real candidates so the UI never shows invented items.
 * Without a model (no key, or the call fails) the caller's data-derived fallback is used.
 */
export async function narrate<S extends z.ZodRawShape>(opts: {
  agent: AgentName;
  phase: string;
  tier: Tier;
  task: string;
  facts: unknown;
  candidates: Candidate[];
  extra: S;
  extraHint: string;
  maxTokens?: number;
  fallback: () => { narration: string; found: string[]; extra: z.infer<z.ZodObject<S>> };
}): Promise<NarrateResult<z.infer<z.ZodObject<S>>>> {
  const byRef = new Map(opts.candidates.map((c) => [c.ref, c.item]));
  const resolve = (refs: string[]) =>
    [...new Set(refs)].map((ref) => byRef.get(ref.trim())).filter((item): item is FoundItem => Boolean(item)).slice(0, 6);

  const fallbackResult = (error: string) => {
    const fb = opts.fallback();
    return { narration: fb.narration, foundItems: resolve(fb.found), extra: fb.extra, modelUsed: false, error };
  };

  if (!hasApiKey()) return fallbackResult("no_key");

  const schema = z.object({ narration: z.string().min(1), found: z.array(z.string()).default([]) }).extend(opts.extra);
  try {
    const out = (await completeJSON({
      tier: opts.tier,
      system: SYSTEM(opts.agent),
      user: [
        `Phase: ${opts.phase}`,
        `Your job in this step: ${opts.task}`,
        "",
        "Data you fetched (JSON):",
        JSON.stringify(opts.facts, null, 1),
        "",
        "Candidates (ref: item):",
        opts.candidates.map((c) => `${c.ref}: ${c.item.label}${c.item.detail ? ` (${c.item.detail})` : ""}`).join("\n") || "(none)",
        "",
        `Return JSON: { "narration": string, "found": string[]${opts.extraHint ? `, ${opts.extraHint}` : ""} }`,
      ].join("\n"),
      schema,
      temperature: 0.3,
      maxTokens: opts.maxTokens ?? 900,
    })) as { narration: string; found: string[] } & z.infer<z.ZodObject<S>>;
    const { narration, found, ...extra } = out;
    const foundItems = resolve(found);
    return {
      narration: narration.trim(),
      foundItems: foundItems.length ? foundItems : resolve(opts.fallback().found),
      extra: extra as z.infer<z.ZodObject<S>>,
      modelUsed: true,
    };
  } catch (error) {
    console.error(`${opts.agent} narration failed`, error);
    return fallbackResult("model_error");
  }
}

/** Joins names as "A, B and C". */
export function listNames(names: string[], max = 3) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) shown.push(`${rest} more`);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}
