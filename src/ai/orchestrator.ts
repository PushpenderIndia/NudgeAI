import { eq } from "drizzle-orm";
import { db } from "@/db";
import { skills as skillsTable } from "@/db/schema";
import { completeJSON, NudgeAIError } from "./client";
import { getRelevantMemories } from "./memory";
import type { Skill } from "@/skills/types";

/**
 * Runs a skill: checks it's enabled, retrieves relevant memories, builds the
 * prompt, and returns schema-validated JSON. This is the single entry point
 * every feature uses to talk to the model.
 */
export async function runSkill<I, O>(skill: Skill<I, O>, input: I): Promise<O> {
  const row = await db.select().from(skillsTable).where(eq(skillsTable.id, skill.id)).get();
  if (row && !row.enabled) {
    throw new NudgeAIError(
      "api_error",
      `The "${row.name}" skill is switched off. Turn it on in Memory & Skills to use it.`
    );
  }

  const query = skill.memoryQuery ? skill.memoryQuery(input) : "";
  const memories = query ? await getRelevantMemories(query) : [];

  return completeJSON({
    tier: skill.tier,
    system: skill.system,
    user: skill.buildUser(input, { memories }),
    schema: skill.schema,
    temperature: skill.temperature,
    maxTokens: skill.maxTokens,
  });
}
