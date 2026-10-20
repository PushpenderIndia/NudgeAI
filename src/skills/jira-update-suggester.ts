import { z } from "zod";
import type { Skill } from "./types";

export const UpdateSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        issueKey: z.string(),
        suggestion: z.string().describe("A short suggested update for this ticket"),
      })
    )
    .describe("Suggested Jira updates mapped from today's work"),
});

export type UpdateSuggestions = z.infer<typeof UpdateSuggestionsSchema>;

export interface UpdateSuggesterInput {
  commits: { repo: string; title: string }[];
  issues: { key: string; summary: string; status: string }[];
}

export const jiraUpdateSuggesterSkill: Skill<UpdateSuggesterInput, UpdateSuggestions> = {
  id: "jira-update-suggester",
  tier: "fast",
  schema: UpdateSuggestionsSchema,
  temperature: 0.3,
  maxTokens: 600,
  system:
    "You are Nudge, matching today's code changes to the user's Jira tickets. For tickets that " +
    "today's work clearly advances, suggest a brief status update or comment the user could add. " +
    "Only include tickets that today's commits actually relate to.",
  buildUser: (input) =>
    [
      "Today's commits:",
      input.commits.map((c) => `- [${c.repo}] ${c.title}`).join("\n") || "(none)",
      "",
      "Assigned Jira tickets:",
      input.issues.map((i) => `- ${i.key} (${i.status}): ${i.summary}`).join("\n") || "(none)",
      "",
      `Return JSON: { "suggestions": [{ "issueKey": string, "suggestion": string }] }`,
    ].join("\n"),
};
