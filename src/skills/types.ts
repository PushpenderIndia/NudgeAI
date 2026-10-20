import type { ZodType } from "zod";
import type { Memory } from "@/db/schema";

export interface SkillContext {
  memories: Memory[];
}

export interface Skill<I, O> {
  /** Stable slug, matches the `skills` table id. */
  id: string;
  tier: "heavy" | "fast";
  system: string;
  schema: ZodType<O>;
  buildUser: (input: I, ctx: SkillContext) => string;
  /** Text used to retrieve relevant memories; omit to skip retrieval. */
  memoryQuery?: (input: I) => string;
  temperature?: number;
  maxTokens?: number;
}
