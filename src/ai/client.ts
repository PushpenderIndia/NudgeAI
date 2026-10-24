import OpenAI from "openai";
import type { ZodType } from "zod";

/**
 * Nebius Token Factory client — OpenAI-compatible.
 * Base URL and model IDs come from env so they're never hardcoded/guessed.
 * Docs: https://docs.tokenfactory.nebius.com/api-reference/introduction
 */
export const NEBIUS_BASE_URL = (
  process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/"
).replace(/\/+$/, "");

// Heavy = stronger Nemotron for reasoning (MoM, weekly, email drafting).
// Fast  = smaller Nemotron for triage/classification/reminders.
export const MODEL_HEAVY = process.env.NEBIUS_MODEL_HEAVY ?? process.env.MODEL_HEAVY ?? "nvidia/nemotron-3-super-120b-a12b";
export const MODEL_FAST = process.env.NEBIUS_MODEL_FAST ?? process.env.MODEL_FAST ?? "nvidia/nemotron-3-super-120b-a12b";

export class NudgeAIError extends Error {
  constructor(
    public code: "missing_key" | "api_error" | "invalid_json",
    public friendly: string,
    cause?: unknown
  ) {
    super(friendly);
    this.cause = cause;
  }
}

export function hasApiKey() {
  return Boolean(process.env.NEBIUS_API_KEY);
}

export function getClient(): OpenAI {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    throw new NudgeAIError(
      "missing_key",
      "Nudge needs a Nebius API key to think. Add NEBIUS_API_KEY to your .env file."
    );
  }
  return new OpenAI({ apiKey, baseURL: NEBIUS_BASE_URL });
}

export function resolveModel(tier: "heavy" | "fast") {
  return tier === "fast" ? MODEL_FAST : MODEL_HEAVY;
}

/** Pull the first well-formed JSON object/array out of a model response. */
function extractJSON(raw: string): string {
  // Strip reasoning traces and code fences some Nemotron models emit.
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  let open = "{";
  let close = "}";
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    open = "[";
    close = "]";
  } else if (firstObj !== -1) {
    start = firstObj;
  }
  if (start === -1) return text;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

interface CompleteJSONArgs<T> {
  tier: "heavy" | "fast";
  system: string;
  user: string;
  schema: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chat completion that returns schema-validated JSON.
 * Retries once if the model returns invalid JSON (per spec).
 */
export async function completeJSON<T>({
  tier,
  system,
  user,
  schema,
  temperature = 0.4,
  maxTokens = 2048,
}: CompleteJSONArgs<T>): Promise<T> {
  const client = getClient();
  const model = resolveModel(tier);
  const sys = `${system}\n\nRespond with ONLY a single valid JSON value. No prose, no markdown, no code fences.`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let content = "";
    try {
      const res = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: attempt === 0 ? user : `${user}\n\nYour previous reply was not valid JSON. Return ONLY valid JSON this time.` },
        ],
      });
      content = res.choices[0]?.message?.content ?? "";
    } catch (err) {
      throw new NudgeAIError(
        "api_error",
        "Nudge couldn't reach its brain just now — please try again in a moment.",
        err
      );
    }

    try {
      return schema.parse(JSON.parse(extractJSON(content)));
    } catch (err) {
      lastError = err;
    }
  }

  throw new NudgeAIError(
    "invalid_json",
    "Nudge got a jumbled answer and couldn't make sense of it. Try again?",
    lastError
  );
}

/** Plain text completion (for the chat panel). */
export async function completeText({
  tier,
  system,
  user,
  temperature = 0.5,
  maxTokens = 1024,
}: {
  tier: "heavy" | "fast";
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = getClient();
  try {
    const res = await client.chat.completions.create({
      model: resolveModel(tier),
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return (res.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  } catch (err) {
    throw new NudgeAIError("api_error", "Nudge couldn't reach its brain just now — please try again.", err);
  }
}
