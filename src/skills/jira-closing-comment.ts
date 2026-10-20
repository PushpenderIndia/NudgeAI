import { z } from "zod";
import type { Skill } from "./types";

export const ClosingCommentSchema = z.object({
  comment: z.string().describe("A concise, professional closing comment for the ticket"),
  suggestedTransition: z.string().describe("The status to move the ticket to, e.g. 'Done'"),
});

export type ClosingComment = z.infer<typeof ClosingCommentSchema>;

export interface ClosingCommentInput {
  key: string;
  summary: string;
  status: string;
  recentWork: string[];
}

export const jiraClosingCommentSkill: Skill<ClosingCommentInput, ClosingComment> = {
  id: "jira-closing-comment",
  tier: "heavy",
  schema: ClosingCommentSchema,
  temperature: 0.4,
  maxTokens: 500,
  system:
    "You are Nudge, writing a closing comment on a finished Jira ticket. Summarise what was " +
    "done, reference the relevant work, and keep it short and professional. Then suggest the " +
    "appropriate next status (usually 'Done').",
  buildUser: (input) =>
    [
      `Ticket: ${input.key} — ${input.summary}`,
      `Current status: ${input.status}`,
      "",
      "Recent related work:",
      input.recentWork.map((w) => `- ${w}`).join("\n") || "(none recorded)",
      "",
      `Return JSON: { "comment": string, "suggestedTransition": string }`,
    ].join("\n"),
};
