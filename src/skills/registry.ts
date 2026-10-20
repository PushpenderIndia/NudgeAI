import { meetingToMomSkill } from "./meeting-to-mom";
import { emailTriageSkill } from "./email-triage";
import { emailReplyDraftSkill } from "./email-reply-draft";
import { taskExtractorSkill } from "./task-extractor";
import { morningBriefSkill } from "./morning-brief";
import type { Skill } from "./types";

/**
 * All skills Nudge can run. Grows as later PRs add skills; the Memory & Skills
 * page lists these and the orchestrator checks each one's enabled flag.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SKILLS: Record<string, Skill<any, any>> = {
  [meetingToMomSkill.id]: meetingToMomSkill,
  [emailTriageSkill.id]: emailTriageSkill,
  [emailReplyDraftSkill.id]: emailReplyDraftSkill,
  [taskExtractorSkill.id]: taskExtractorSkill,
  [morningBriefSkill.id]: morningBriefSkill,
};

export function getSkill(id: string) {
  return SKILLS[id];
}
