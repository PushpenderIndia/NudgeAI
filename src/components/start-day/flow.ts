import type { Briefing, PlanBlock, StandupDraft } from "@/nudge/briefing";
import type { BriefingAnswers } from "@/nudge/scenes";
import type { Ticket } from "@/nudge/types";
import type { AnswerVia } from "./api";
import { linesToStandup, type DiffLine } from "./standup";

export type Decision = "confirm" | "decline";

export type ConfirmState = {
  decision: Decision;
  via: AnswerVia;
  undoUntil?: string;
  /** Skipped: nothing recorded, the action is still waiting in Needs your OK. */
  skipped?: boolean;
  at?: string;
};

/** What the briefing has changed on the page so far; anything unset falls back to the saved briefing. */
export type FlowOverrides = {
  catch?: ConfirmState | null;
  pickId?: string | null;
  plan?: PlanBlock[];
  todo?: Ticket[];
  standup?: StandupDraft;
  diff?: DiffLine[] | null;
  editor?: boolean;
  post?: ConfirmState | null;
};

export type DayState = {
  catch: ConfirmState | null;
  pickId: string | null;
  plan: PlanBlock[];
  todo: Ticket[];
  standup: StandupDraft;
  diff: DiffLine[] | null;
  editor: boolean;
  post: ConfirmState | null;
};

const EMPTY_STANDUP: StandupDraft = { yesterday: [], today: [], blockers: [] };

/** The page as saved on the run (settled page, later visits). */
export function savedState(b: Briefing | null, answers: BriefingAnswers | undefined): DayState {
  return {
    catch: answers?.catch ? { decision: answers.catch.decision, via: answers.catch.via } : null,
    pickId: answers?.pick?.choiceId ?? null,
    plan: b?.plan ?? [],
    todo: b?.todo ?? [],
    standup: b?.standup ?? EMPTY_STANDUP,
    diff: null,
    editor: false,
    post: answers?.post ? { decision: answers.post.decision, via: answers.post.via } : null,
  };
}

/** The briefing's state from scratch: a live run starts clean, a replay starts before its first edit. */
export function initialOverrides(answers: BriefingAnswers | undefined, replay: boolean): FlowOverrides {
  const first = answers?.standupEdits?.[0]?.before;
  return {
    catch: null,
    pickId: null,
    post: null,
    diff: null,
    editor: false,
    ...(replay && first ? { standup: linesToStandup(first) } : {}),
  };
}

export function resolve(b: Briefing | null, answers: BriefingAnswers | undefined, overrides: FlowOverrides | null): DayState {
  const saved = savedState(b, answers);
  if (!overrides) return saved;
  const out = { ...saved };
  for (const key of Object.keys(overrides) as (keyof FlowOverrides)[]) {
    if (overrides[key] !== undefined) (out as Record<string, unknown>)[key] = overrides[key];
  }
  return out;
}

export const isUrgent = (t: Pick<Ticket, "priority">) => t.priority === "P1";
