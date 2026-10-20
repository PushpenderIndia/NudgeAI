"use client";

import { useState } from "react";
import { FileText, Check, X, ArrowRight, AlertCircle } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";

export function ClosingCommentCard({ issueKey }: { issueKey: string }) {
  const [state, setState] = useState<"idle" | "loading" | "drafted" | "posting" | "done" | "error">("idle");
  const [comment, setComment] = useState("");
  const [transition, setTransition] = useState("Done");
  const [error, setError] = useState("");

  async function draft() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/skills/jira-closing-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't draft a comment.");
      setComment(data.comment);
      setTransition(data.suggestedTransition ?? "Done");
      setState("drafted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  async function approve() {
    setState("posting");
    const res = await fetch("/api/dev/jira-execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey, comment, toStatus: transition }),
    });
    const data = await res.json();
    if (res.ok && data.ok) setState("done");
    else {
      setError(data.results?.find((r: { ok: boolean }) => !r.ok)?.message ?? "Couldn't post.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success animate-fade-up">
        <Check className="h-4 w-4" /> Posted the comment and moved {issueKey} to {transition}. Logged in your activity feed.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2/30 p-3">
      {state === "idle" && (
        <Button size="sm" variant="secondary" onClick={draft}>
          <FileText className="h-4 w-4" /> Draft closing comment
        </Button>
      )}

      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <OwlMark size={18} /> Drafting a closing comment…
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {(state === "drafted" || state === "posting") && (
        <div className="animate-fade-up space-y-3">
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm text-fg/90">{comment}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ArrowRight className="h-3.5 w-3.5" /> Suggested: move to <span className="text-primary-soft">{transition}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="success" onClick={approve} disabled={state === "posting"}>
              {state === "posting" ? <><OwlMark size={14} /> Posting…</> : <><Check className="h-4 w-4" /> Approve &amp; post</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState("idle")}>
              <X className="h-4 w-4" /> Discard
            </Button>
          </div>
          <p className="text-xs text-muted">Nothing is posted to Jira until you approve.</p>
        </div>
      )}
    </div>
  );
}
