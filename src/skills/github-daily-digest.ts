import { z } from "zod";
import type { Skill } from "./types";

export const DigestSchema = z.object({
  summary: z.string().describe("Plain-language paragraph of what was shipped today"),
  highlights: z.array(z.string()).describe("Short bullet highlights, no jargon"),
});

export type Digest = z.infer<typeof DigestSchema>;

export interface DigestInput {
  commits: { repo: string; title: string }[];
  prs: { repo: string; title: string }[];
}

export const githubDailyDigestSkill: Skill<DigestInput, Digest> = {
  id: "github-daily-digest",
  tier: "heavy",
  schema: DigestSchema,
  temperature: 0.4,
  maxTokens: 700,
  system:
    "You are Nudge, turning a developer's raw git activity into a plain-language progress " +
    "summary a non-technical manager could read. Explain what was actually achieved, not the " +
    "commit mechanics. Be concise, warm and specific. Avoid jargon and internal file names.",
  buildUser: (input) =>
    [
      "Today's commits:",
      input.commits.map((c) => `- [${c.repo}] ${c.title}`).join("\n") || "(none)",
      "",
      "Today's pull requests:",
      input.prs.map((p) => `- [${p.repo}] ${p.title}`).join("\n") || "(none)",
      "",
      `Return JSON: { "summary": string, "highlights": string[] }`,
    ].join("\n"),
};
