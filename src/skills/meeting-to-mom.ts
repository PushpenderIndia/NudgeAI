import { z } from "zod";
import type { Skill } from "./types";
import { formatMemories } from "@/ai/memory";

export const MomSchema = z.object({
  summary: z.string().describe("2-3 sentence plain-language summary of the meeting"),
  decisions: z.array(z.string()).describe("Concrete decisions made"),
  discussionPoints: z.array(z.string()).describe("Key points discussed"),
  actionItems: z
    .array(
      z.object({
        title: z.string(),
        owner: z.string().describe("Person responsible; use a real attendee name"),
        due: z.string().describe("Due date or timeframe, e.g. 'Friday' or 'Next week'"),
      })
    )
    .describe("Follow-up tasks with an owner and a due date"),
});

export type Mom = z.infer<typeof MomSchema>;

export interface MomInput {
  title: string;
  attendees: string[];
  transcript: string;
}

export const meetingToMomSkill: Skill<MomInput, Mom> = {
  id: "meeting-to-mom",
  tier: "heavy",
  schema: MomSchema,
  temperature: 0.3,
  maxTokens: 1800,
  system:
    "You are Nudge, a calm and precise executive assistant. You turn meeting transcripts " +
    "into clean minutes. Be accurate and concise, use the attendees' real names for action " +
    "item owners, and never invent decisions that weren't made. Keep language plain and warm.",
  memoryQuery: (input) => `${input.title} ${input.attendees.join(" ")}`,
  buildUser: (input, ctx) =>
    [
      `Meeting: ${input.title}`,
      `Attendees: ${input.attendees.join(", ")}`,
      "",
      "What Nudge remembers (for context — people, projects, preferences):",
      formatMemories(ctx.memories),
      "",
      "Transcript:",
      input.transcript,
      "",
      "Produce the minutes as JSON with this shape:",
      `{ "summary": string, "decisions": string[], "discussionPoints": string[], ` +
        `"actionItems": [{ "title": string, "owner": string, "due": string }] }`,
    ].join("\n"),
};
