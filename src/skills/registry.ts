import { meetingToMomSkill } from "./meeting-to-mom";
import type { Skill } from "./types";

/**
 * All skills Nudge can run. Grows as later PRs add skills; the Memory & Skills
 * page lists these and the orchestrator checks each one's enabled flag.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SKILLS: Record<string, Skill<any, any>> = {
  [meetingToMomSkill.id]: meetingToMomSkill,
};

export function getSkill(id: string) {
  return SKILLS[id];
}
