import { z } from "zod";
import { AGENT_NAMES } from "./types";

/** Page sections a scene can reveal (and outline while it is spoken). */
export const SECTION_IDS = [
  "welcome",
  "graph",
  "catch",
  "picks",
  "plan",
  "standup",
  "post",
  "inbox",
  "wrapup",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SCENE_IDS = ["welcome", "team", "catch", "picks", "plan", "standup", "post", "inbox", "wrapup"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const InteractionSchema = z.object({
  type: z.enum(["confirm", "choice", "edit"]),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  /** The pending_actions row this confirm resolves. */
  pendingActionId: z.string().optional(),
});
export type Interaction = z.infer<typeof InteractionSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  agent: z.enum(AGENT_NAMES),
  speech: z.string(),
  captionHighlights: z.array(z.string()).default([]),
  reveals: z.array(z.object({ section: z.enum(SECTION_IDS), itemIds: z.array(z.string()).optional() })).default([]),
  interaction: InteractionSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SceneScriptSchema = z.object({ scenes: z.array(SceneSchema).min(1) });
export type SceneScript = z.infer<typeof SceneScriptSchema>;

/** Output of the fast-tier intent parser (POST /api/briefing/intent). */
export const IntentSchema = z.object({
  intent: z.enum(["confirm", "decline", "choose", "edit", "done", "unknown"]),
  choiceId: z.string().optional(),
  editInstruction: z.string().optional(),
});
export type Intent = z.infer<typeof IntentSchema>;

/** What the user did at each interaction; saved on the run so Replay needs no model calls. */
export type BriefingAnswers = {
  catch?: { decision: "confirm" | "decline"; via: "voice" | "click" | "text" };
  pick?: { choiceId: string; via: "voice" | "click" | "text" };
  /** Spoken line generated after the pick (fast tier). */
  planSpeech?: string;
  standupEdits?: { instruction: string; before: string[]; after: string[] }[];
  standupFinal?: string[];
  post?: { decision: "confirm" | "decline"; via: "voice" | "click" | "text" };
};
