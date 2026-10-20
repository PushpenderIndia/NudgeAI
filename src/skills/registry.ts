import { meetingToMomSkill } from "./meeting-to-mom";
import { emailTriageSkill } from "./email-triage";
import { emailReplyDraftSkill } from "./email-reply-draft";
import { taskExtractorSkill } from "./task-extractor";
import { morningBriefSkill } from "./morning-brief";
import { githubDailyDigestSkill } from "./github-daily-digest";
import { jiraClosingCommentSkill } from "./jira-closing-comment";
import { jiraUpdateSuggesterSkill } from "./jira-update-suggester";
import { weeklyUpdateSkill } from "./weekly-update";
import { reminderEngineSkill } from "./reminder-engine";
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
  [githubDailyDigestSkill.id]: githubDailyDigestSkill,
  [jiraClosingCommentSkill.id]: jiraClosingCommentSkill,
  [jiraUpdateSuggesterSkill.id]: jiraUpdateSuggesterSkill,
  [weeklyUpdateSkill.id]: weeklyUpdateSkill,
  [reminderEngineSkill.id]: reminderEngineSkill,
};

export function getSkill(id: string) {
  return SKILLS[id];
}
