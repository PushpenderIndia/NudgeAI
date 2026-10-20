import { z } from "zod";
import type { Skill } from "./types";
import { formatMemories } from "@/ai/memory";

export const BriefSchema = z.object({
  brief: z.string().describe("A short, warm 2-4 sentence summary of the day"),
  topPriority: z.string().describe("The single most important thing to do right now, one sentence"),
});

export type Brief = z.infer<typeof BriefSchema>;

export interface BriefInput {
  userName: string;
  meetings: { title: string; time: string }[];
  urgentEmails: { from: string; subject: string }[];
  tasks: { title: string; priority: string }[];
  jira: { key: string; summary: string; status: string }[];
  commitsCount: number;
}

export const morningBriefSkill: Skill<BriefInput, Brief> = {
  id: "morning-brief",
  tier: "heavy",
  schema: BriefSchema,
  temperature: 0.5,
  maxTokens: 500,
  system:
    "You are Nudge, a calm, friendly office buddy. Write a short morning brief that helps the " +
    "user feel on top of their day. Be warm but not gushing, specific, and concise. Address the " +
    "user by name once. Then name the single most important thing to focus on right now.",
  memoryQuery: (input) => input.tasks.map((t) => t.title).join(" ") + " " + input.urgentEmails.map((e) => e.subject).join(" "),
  buildUser: (input, ctx) =>
    [
      `User: ${input.userName}`,
      "",
      "Context Nudge remembers:",
      formatMemories(ctx.memories),
      "",
      `Meetings today: ${input.meetings.map((m) => `${m.time} ${m.title}`).join("; ") || "none"}`,
      `Urgent emails: ${input.urgentEmails.map((e) => `${e.from} — ${e.subject}`).join("; ") || "none"}`,
      `Open tasks: ${input.tasks.map((t) => `${t.title} (${t.priority})`).join("; ") || "none"}`,
      `Jira: ${input.jira.map((j) => `${j.key} ${j.summary} [${j.status}]`).join("; ") || "none"}`,
      `Commits today: ${input.commitsCount}`,
      "",
      `Return JSON: { "brief": string, "topPriority": string }`,
    ].join("\n"),
};
