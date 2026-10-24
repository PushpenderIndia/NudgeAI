import type { ZodType } from "zod";
import { completeJSON, completeText, hasApiKey } from "@/ai/client";
import type { Tier } from "@/ai/agents/runs";

export const MODEL_TIMEOUT_MS = 6000;

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e))
    );
  });
}

export type Modelled<T> = { value: T; modelUsed: boolean };

/** One schema-validated model call with a timeout; no key or any failure → the data-derived fallback. */
export async function modelJSON<T>(
  opts: { tier: Tier; system: string; user: string; schema: ZodType<T>; maxTokens?: number; timeoutMs?: number },
  fallback: () => T
): Promise<Modelled<T>> {
  if (!hasApiKey()) return { value: fallback(), modelUsed: false };
  try {
    const value = await withTimeout(
      completeJSON({ tier: opts.tier, system: opts.system, user: opts.user, schema: opts.schema, maxTokens: opts.maxTokens ?? 800, temperature: 0.3 }),
      opts.timeoutMs ?? MODEL_TIMEOUT_MS
    );
    return { value, modelUsed: true };
  } catch (error) {
    console.warn(`model ${opts.tier} call fell back:`, error instanceof Error ? error.message : error);
    return { value: fallback(), modelUsed: false };
  }
}

export async function modelText(
  opts: { tier: Tier; system: string; user: string; maxTokens?: number; timeoutMs?: number },
  fallback: () => string
): Promise<Modelled<string>> {
  if (!hasApiKey()) return { value: fallback(), modelUsed: false };
  try {
    const value = await withTimeout(completeText({ tier: opts.tier, system: opts.system, user: opts.user, maxTokens: opts.maxTokens ?? 200 }), opts.timeoutMs ?? MODEL_TIMEOUT_MS);
    return value.trim() ? { value: value.trim(), modelUsed: true } : { value: fallback(), modelUsed: false };
  } catch (error) {
    console.warn(`model ${opts.tier} text fell back:`, error instanceof Error ? error.message : error);
    return { value: fallback(), modelUsed: false };
  }
}

export const VOICE_RULES = [
  "Write plain, specific, first-person lines a calm colleague would say out loud.",
  "Use only facts present in the data: real ticket keys, PR numbers, names, times and counts.",
  "No hype, no emoji, no exclamation marks, never mention AI or models.",
].join("\n");
