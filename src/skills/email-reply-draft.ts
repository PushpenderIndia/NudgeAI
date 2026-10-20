import { z } from "zod";
import type { Skill } from "./types";
import { formatMemories } from "@/ai/memory";

export const ReplyDraftSchema = z.object({
  subject: z.string(),
  body: z.string().describe("The full reply body, ready to send"),
});

export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

export interface ReplyDraftInput {
  fromName: string;
  subject: string;
  body: string;
  tone: string; // formal | friendly | concise
  instruction?: string; // optional user steer, e.g. "say I'll send it by Friday"
}

const TONE_HINT: Record<string, string> = {
  formal: "professional and polished",
  friendly: "warm and personable",
  concise: "brief and to the point",
};

export const emailReplyDraftSkill: Skill<ReplyDraftInput, ReplyDraft> = {
  id: "email-reply-draft",
  tier: "heavy",
  schema: ReplyDraftSchema,
  temperature: 0.5,
  maxTokens: 700,
  system:
    "You are Nudge, drafting an email reply on the user's behalf. Match the user's tone and " +
    "writing style from the remembered preferences. Be helpful and clear. Do not invent facts " +
    "or make commitments the user hasn't implied. Write only the reply the user would send.",
  memoryQuery: (input) => `${input.fromName} ${input.subject} writing style tone preference`,
  buildUser: (input, ctx) =>
    [
      `Write a reply in a ${TONE_HINT[input.tone] ?? input.tone} tone.`,
      input.instruction ? `The user wants the reply to: ${input.instruction}` : "",
      "",
      "What Nudge remembers about the user's style and the people involved:",
      formatMemories(ctx.memories),
      "",
      "--- Email to reply to ---",
      `From: ${input.fromName}`,
      `Subject: ${input.subject}`,
      "",
      input.body,
      "",
      `Return JSON: { "subject": string, "body": string }. Use "Re: ..." for the subject.`,
    ]
      .filter(Boolean)
      .join("\n"),
};
