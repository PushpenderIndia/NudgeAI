import { z } from "zod";
import type { Skill } from "./types";
import { formatMemories } from "@/ai/memory";

export const WeeklyUpdateSchema = z.object({
  highlights: z.array(z.string()).describe("The week's wins, as short bullets"),
  progress: z.array(z.string()).describe("What moved forward this week"),
  blockers: z.array(z.string()).describe("What's stuck or needs help"),
  nextWeek: z.array(z.string()).describe("The plan for next week"),
});

export type WeeklyUpdate = z.infer<typeof WeeklyUpdateSchema>;

export type WeeklySection = "highlights" | "progress" | "blockers" | "nextWeek";

export interface WeeklyUpdateInput {
  meetings: string[];
  urgentEmails: string[];
  commits: string[];
  prs: string[];
  jira: { key: string; summary: string; status: string }[];
  doneTasks: string[];
  focusSection?: WeeklySection;
}

const SECTION_LABEL: Record<WeeklySection, string> = {
  highlights: "Highlights",
  progress: "Progress",
  blockers: "Blockers",
  nextWeek: "Next week",
};

export const weeklyUpdateSkill: Skill<WeeklyUpdateInput, WeeklyUpdate> = {
  id: "weekly-update",
  tier: "heavy",
  schema: WeeklyUpdateSchema,
  temperature: 0.5,
  maxTokens: 1200,
  system:
    "You are Nudge, writing a professional weekly update for the user to share with their team. " +
    "Compile the week's work across meetings, email, commits/PRs and Jira into four sections: " +
    "Highlights (notable wins), Progress (what moved forward), Blockers (what's stuck or needs help), " +
    "and Next week (the plan). Use concise, specific bullet points in the user's voice. Don't pad.",
  memoryQuery: (input) => input.jira.map((j) => j.summary).join(" ") + " " + input.meetings.join(" "),
  buildUser: (input, ctx) =>
    [
      "Context Nudge remembers:",
      formatMemories(ctx.memories),
      "",
      `Meetings this week: ${input.meetings.join("; ") || "none"}`,
      `Urgent emails: ${input.urgentEmails.join("; ") || "none"}`,
      `Commits: ${input.commits.join("; ") || "none"}`,
      `Pull requests: ${input.prs.join("; ") || "none"}`,
      `Jira: ${input.jira.map((j) => `${j.key} ${j.summary} [${j.status}]`).join("; ") || "none"}`,
      `Completed tasks: ${input.doneTasks.join("; ") || "none"}`,
      "",
      input.focusSection
        ? `Pay special attention to the "${SECTION_LABEL[input.focusSection]}" section and make those bullets as sharp and useful as possible, while still returning all four sections.`
        : "",
      "",
      `Return JSON: { "highlights": string[], "progress": string[], "blockers": string[], "nextWeek": string[] }`,
    ]
      .filter(Boolean)
      .join("\n"),
};
