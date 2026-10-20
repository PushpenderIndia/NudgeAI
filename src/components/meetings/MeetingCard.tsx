"use client";

import { useState } from "react";
import { Clock, Users, FileText, ListPlus, Copy, Check, PenLine, AlertCircle } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";

interface Mom {
  summary: string;
  decisions: string[];
  discussionPoints: string[];
  actionItems: { title: string; owner: string; due: string }[];
}

export interface MeetingDTO {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: string[];
  hasTranscript: boolean;
  hasMom: boolean;
}

function momToMarkdown(title: string, mom: Mom): string {
  return [
    `# Minutes — ${title}`,
    "",
    "## Summary",
    mom.summary,
    "",
    "## Decisions",
    ...mom.decisions.map((d) => `- ${d}`),
    "",
    "## Discussion",
    ...mom.discussionPoints.map((d) => `- ${d}`),
    "",
    "## Action items",
    ...mom.actionItems.map((a) => `- [ ] ${a.title} — **${a.owner}** (due ${a.due})`),
    "",
  ].join("\n");
}

export function MeetingCard({ meeting }: { meeting: MeetingDTO }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [mom, setMom] = useState<Mom | null>(null);
  const [error, setError] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/skills/meeting-to-mom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't generate minutes.");
      setMom(data.mom);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  async function addAllToTasks() {
    if (!mom) return;
    await fetch("/api/tasks/from-mom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: meeting.id, meetingTitle: meeting.title, actionItems: mom.actionItems }),
    });
    setAdded(true);
  }

  async function copyMd() {
    if (!mom) return;
    await navigator.clipboard.writeText(momToMarkdown(meeting.title, mom));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h3 className="font-semibold">{meeting.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatTime(meeting.startsAt)} – {formatTime(meeting.endsAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {meeting.attendees.length} people
            </span>
            {meeting.hasMom && <Badge variant="success">Minutes ready</Badge>}
          </div>
        </div>
        {meeting.hasTranscript ? (
          <Button size="sm" onClick={generate} disabled={state === "loading"}>
            {state === "loading" ? (
              <>
                <OwlMark size={16} /> Give me a moment…
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4" /> {state === "done" ? "Rewrite the minutes" : "Write the minutes"}
              </>
            )}
          </Button>
        ) : (
          <Badge variant="default">No transcript yet</Badge>
        )}
      </div>

      {state === "loading" && (
        <div className="flex items-center gap-3 border-t border-border bg-surface-2/30 px-5 py-6 text-sm text-muted">
          <OwlMark size={28} />
          I&apos;m reading the transcript and writing the minutes…
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 border-t border-border bg-danger/5 px-5 py-4 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {state === "done" && mom && (
        <div className="animate-fade-up space-y-4 border-t border-border bg-surface-2/20 p-5 text-sm">
          <section>
            <h4 className="mb-1 flex items-center gap-1.5 font-semibold text-primary-soft">
              <FileText className="h-4 w-4" /> Summary
            </h4>
            <p className="text-fg/90">{mom.summary}</p>
          </section>

          {mom.decisions.length > 0 && (
            <section>
              <h4 className="mb-1 font-semibold text-primary-soft">Decisions</h4>
              <ul className="list-disc space-y-1 pl-5 text-fg/90">
                {mom.decisions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}

          {mom.discussionPoints.length > 0 && (
            <section>
              <h4 className="mb-1 font-semibold text-primary-soft">Discussion</h4>
              <ul className="list-disc space-y-1 pl-5 text-fg/90">
                {mom.discussionPoints.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}

          {mom.actionItems.length > 0 && (
            <section>
              <h4 className="mb-2 font-semibold text-primary-soft">Action items</h4>
              <ul className="space-y-1.5">
                {mom.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span className="flex-1">
                      {a.title}
                      <span className="ml-2 text-xs text-muted">· {a.owner} · due {a.due}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={addAllToTasks} disabled={added}>
              <ListPlus className="h-4 w-4" /> {added ? "Added to tasks" : "Add all to tasks"}
            </Button>
            <Button size="sm" variant="ghost" onClick={copyMd}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy as Markdown"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
