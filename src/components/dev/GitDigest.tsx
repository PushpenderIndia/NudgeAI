"use client";

import { useState } from "react";
import { GitCommit, GitPullRequest, FileText, AlertCircle } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface GitItemDTO {
  type: "commit" | "pr" | "review";
  repo: string;
  title: string;
}

export function GitDigest({ items }: { items: GitItemDTO[] }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [error, setError] = useState("");

  const commits = items.filter((i) => i.type === "commit");
  const prs = items.filter((i) => i.type === "pr");

  async function run() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/skills/github-daily-digest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't summarise.");
      setSummary(data.summary);
      setHighlights(data.highlights ?? []);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Today&apos;s code</h2>
          <p className="mt-1 flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1"><GitCommit className="h-3.5 w-3.5" /> {commits.length} commits</span>
            <span className="flex items-center gap-1"><GitPullRequest className="h-3.5 w-3.5" /> {prs.length} PRs</span>
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={state === "loading"}>
          {state === "loading" ? <><OwlMark size={16} /> Give me a moment…</> : <><FileText className="h-4 w-4" /> Write today&apos;s summary</>}
        </Button>
      </div>

      {state === "error" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {state === "done" && (
        <div className="mt-4 animate-fade-up space-y-3 border-t border-border pt-4 text-sm">
          <p className="text-fg/90">{summary}</p>
          {highlights.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-fg/90">
              {highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
        </div>
      )}

      {state === "idle" && (
        <div className="mt-4 space-y-1 border-t border-border pt-4">
          {items.slice(0, 6).map((it, i) => (
            <p key={i} className="truncate text-xs text-muted">
              <span className="text-fg/70">[{it.repo}]</span> {it.title}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
