import { z } from "zod";
import type { Skill } from "./types";

export const ReminderSchema = z.object({
  message: z.string().describe("A short, friendly reminder in Nudge's voice (owl puns welcome but not cringe)"),
});

export type ReminderMessage = z.infer<typeof ReminderSchema>;

export interface ReminderInput {
  kind: "timesheet" | "eod" | "weekly" | "custom";
  userName: string;
  detail?: string;
}

export const reminderEngineSkill: Skill<ReminderInput, ReminderMessage> = {
  id: "reminder-engine",
  tier: "fast",
  schema: ReminderSchema,
  temperature: 0.7,
  maxTokens: 120,
  system:
    "You are Nudge, a warm owl office buddy. Write ONE short, friendly reminder (max 20 words). " +
    "Be encouraging, a little playful, never cringe. Australian English.",
  buildUser: (input) =>
    [
      `Reminder type: ${input.kind}`,
      `User: ${input.userName}`,
      input.detail ? `Detail: ${input.detail}` : "",
      "",
      `Return JSON: { "message": string }`,
    ]
      .filter(Boolean)
      .join("\n"),
};
