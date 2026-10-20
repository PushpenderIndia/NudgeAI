"use client";

import { useState } from "react";
import { Lightbulb, FileText, AlertCircle } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Suggestion {
  issueKey: string;
  suggestion: string;
}

export function SuggestedUpdates() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");

  async function run() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/skills/jira-update-suggester", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't suggest updates.");
      setSuggestions(data.suggestions ?? []);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-nudge" />
          <h2 className="font-semibold">Suggested Jira updates from today&apos;s work</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={run} disabled={state === "loading"}>
          {state === "loading" ? <><OwlMark size={16} /> Give me a moment…</> : <><FileText className="h-4 w-4" /> Review updates</>}
        </Button>
      </div>

      {state === "error" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {state === "done" && (
        <div className="mt-4 animate-fade-up space-y-2 border-t border-border pt-4">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted">No updates suggested — today&apos;s work doesn&apos;t map cleanly to a ticket.</p>
          ) : (
            suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-surface-2/30 p-3 text-sm">
                <Badge variant="jira">{s.issueKey}</Badge>
                <span className="text-fg/90">{s.suggestion}</span>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
