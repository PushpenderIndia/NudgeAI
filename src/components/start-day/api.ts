import type { BriefingView } from "@/nudge/agents/view";
import type { PlanBlock, StandupDraft } from "@/nudge/briefing";
import type { Ticket } from "@/nudge/types";

export type { BriefingView };
export type AnswerVia = "voice" | "click" | "text";

async function post<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const startBriefing = (force = false) => post<{ runId: string }>("/api/briefing/start", { force });

export async function fetchView(runId: string, fallback = false): Promise<BriefingView | null> {
  try {
    const res = await fetch(`/api/briefing/${runId}${fallback ? "?fallback=1" : ""}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as BriefingView) : null;
  } catch {
    return null;
  }
}

export type CatchResult = { ok: boolean; message: string; undoUntil?: string; standup?: StandupDraft };
export type PickResult = { plan: PlanBlock[]; speech: string; todo: Ticket[]; standup: StandupDraft };
export type EditResult = { before: string[]; after: string[]; standup: StandupDraft; speech?: string };
export type PostResult = { ok: boolean; message: string; undoUntil?: string };

export const answer = {
  catch: (runId: string, decision: "confirm" | "decline", via: AnswerVia) =>
    post<CatchResult>(`/api/briefing/${runId}/answer`, { kind: "catch", decision, via }),
  pick: (runId: string, choiceId: string, via: AnswerVia) => post<PickResult>(`/api/briefing/${runId}/answer`, { kind: "pick", choiceId, via }),
  edit: (runId: string, instruction: string) => post<EditResult>(`/api/briefing/${runId}/answer`, { kind: "edit", instruction }),
  replace: (runId: string, standup: StandupDraft) => post<EditResult>(`/api/briefing/${runId}/answer`, { kind: "replace", standup }),
  done: (runId: string) => post<{ standup: StandupDraft }>(`/api/briefing/${runId}/answer`, { kind: "done" }),
  post: (runId: string, decision: "confirm" | "decline", via: AnswerVia) =>
    post<PostResult>(`/api/briefing/${runId}/answer`, { kind: "post", decision, via }),
};

export type PendingApproval = {
  id: string;
  actionType: string;
  summary: string;
  payload: Record<string, unknown>;
  draftContent: unknown;
  createdAt: string | null;
};

export async function listApprovals(): Promise<PendingApproval[]> {
  try {
    const res = await fetch("/api/approvals", { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { pending: PendingApproval[] }).pending;
  } catch {
    return [];
  }
}

export async function approve(id: string, via: "voice" | "click" = "click") {
  const out = await post<{ results: { id: string; ok: boolean; message: string; undoUntil?: string }[] }>("/api/approvals/approve", { id, via });
  return out?.results[0] ?? null;
}

export const undo = (id: string) => post<{ ok: boolean; message: string }>("/api/approvals/undo", { id });
export const dismiss = (id: string) => post<{ ok: boolean; message: string }>("/api/approvals/reject", { id });
export const startPrep = (eventId: string) => post<{ runId: string }>("/api/briefing/prep", { eventId });
export const startWeekly = () => post<{ runId: string }>("/api/briefing/weekly");
