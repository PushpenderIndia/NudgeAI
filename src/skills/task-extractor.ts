import { z } from "zod";
import type { Skill } from "./types";

export const ExtractedTaskSchema = z.object({
  title: z.string().describe("A short, actionable task title"),
  priority: z.enum(["today", "this_week", "urgent"]),
  due: z.string().nullable().describe("Due date/timeframe if stated, else null"),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export interface TaskExtractInput {
  fromName: string;
  subject: string;
  body: string;
}

export const taskExtractorSkill: Skill<TaskExtractInput, ExtractedTask> = {
  id: "task-extractor",
  tier: "fast",
  schema: ExtractedTaskSchema,
  temperature: 0.2,
  maxTokens: 250,
  system:
    "You are Nudge, turning an email into a single clear to-do for the user. Capture the one " +
    "action the user needs to take. Keep the title short and action-first (e.g. 'Send Atlas summary to Priya').",
  buildUser: (input) =>
    [
      `From: ${input.fromName}`,
      `Subject: ${input.subject}`,
      "",
      input.body,
      "",
      `Return JSON: { "title": string, "priority": "today" | "this_week" | "urgent", "due": string | null }`,
    ].join("\n"),
};
