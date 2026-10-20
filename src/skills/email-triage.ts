import { z } from "zod";
import type { Skill } from "./types";

export const TriageSchema = z.object({
  triage: z.enum(["urgent", "needs_reply", "fyi"]),
  reason: z.string().describe("One short sentence explaining the classification"),
});

export type TriageResult = z.infer<typeof TriageSchema>;

export interface TriageInput {
  fromName: string;
  subject: string;
  body: string;
}

export const emailTriageSkill: Skill<TriageInput, TriageResult> = {
  id: "email-triage",
  tier: "fast",
  schema: TriageSchema,
  temperature: 0.2,
  maxTokens: 300,
  system:
    "You are Nudge, triaging a worker's inbox. Classify one email as exactly one of: " +
    "'urgent' (time-sensitive, blocks others, or has a near deadline), " +
    "'needs_reply' (a person expects a response but it's not urgent), or " +
    "'fyi' (notifications, newsletters, no action needed). Be decisive.",
  buildUser: (input) =>
    [
      `From: ${input.fromName}`,
      `Subject: ${input.subject}`,
      "",
      input.body,
      "",
      `Return JSON: { "triage": "urgent" | "needs_reply" | "fyi", "reason": string }`,
    ].join("\n"),
};
