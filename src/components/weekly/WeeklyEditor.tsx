"use client";

import { useState } from "react";
import {
  FileText,
  RotateCw,
  Copy,
  Download,
  Check,
  Trophy,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { weeklyToMarkdown } from "@/lib/export/markdown";
import { AgentTrace, type AgentTraceRun } from "@/components/agents/AgentTrace";
import type { WeeklyUpdate, WeeklySection } from "@/skills/weekly-update";

const SECTIONS: { key: WeeklySection; label: string; icon: typeof Trophy; accent: string }[] = [
  { key: "highlights", label: "Highlights", icon: Trophy, accent: "text-nudge" },
  { key: "progress", label: "Progress", icon: TrendingUp, accent: "text-success" },
  { key: "blockers", label: "Blockers", icon: AlertTriangle, accent: "text-danger" },
  { key: "nextWeek", label: "Next week", icon: ArrowRight, accent: "text-primary-soft" },
];

const EMPTY: WeeklyUpdate = { highlights: [], progress: [], blockers: [], nextWeek: [] };

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WeeklyEditor({ daily }: { daily: { day: string; bullets: string[] }[] }) {
  const [sections, setSections] = useState<WeeklyUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState<WeeklySection | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [trace, setTrace] = useState<AgentTraceRun | null>(null);

  async function generate(section?: WeeklySection) {
    if (section) setRegenerating(section);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/skills/weekly-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(section ? { section } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Couldn't generate the update.");
      if (section) {
        setSections((s) => ({ ...(s ?? EMPTY), [section]: data[section] }));
      } else {
        setSections(data);
      }
      if (data.trace) setTrace(data.trace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setRegenerating(null);
    }
  }

  function setLines(key: WeeklySection, text: string) {
    setSections((s) => ({ ...(s ?? EMPTY), [key]: text.split("\n").map((l) => l.replace(/^[-*]\s*/, "")) }));
  }

  async function copy() {
    if (!sections) return;
    await navigator.clipboard.writeText(weeklyToMarkdown(sections));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!sections) {
    return (
      <div className="space-y-8">
        <section><h2 className="mb-3 text-base font-semibold">This week, day by day</h2><div className="divide-y divide-border border-y border-border">{daily.map((item, index) => <div key={item.day} className="py-4"><div className="flex items-center justify-between"><h3 className="font-medium">{item.day}</h3>{index === new Date().getDay() - 1 && <span className="text-xs text-primary-soft">In progress</span>}</div>{item.bullets.length ? <ul className="mt-2 space-y-1 text-sm text-fg/80">{item.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}</ul> : <p className="mt-2 text-sm text-muted">No connected work recorded.</p>}</div>)}</div></section>
        <div className="border-t border-border pt-5"><Button className="w-full sm:w-auto" onClick={() => generate()} disabled={loading}>{loading ? <><OwlMark size={16} /> Reporter is compiling…</> : <><FileText className="h-4 w-4" /> Generate weekly update</>}</Button></div>
        {trace && <AgentTrace run={trace} />}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => generate()} disabled={loading}>
          {loading ? <><OwlMark size={16} /> Updating…</> : <><RotateCw className="h-4 w-4" /> Refresh all</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => download("weekly-update.md", weeklyToMarkdown(sections), "text/markdown")}>
          <Download className="h-4 w-4" /> Export .md
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            download(
              "weekly-update.doc",
              `<html><body><pre style="font-family:sans-serif">${weeklyToMarkdown(sections)}</pre></body></html>`,
              "application/msword"
            )
          }
        >
          <Download className="h-4 w-4" /> Export .doc
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {trace && <AgentTrace collapsed run={trace} />}

      {SECTIONS.map(({ key, label, icon: Icon, accent }) => (
        <div key={key} className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className={`flex items-center gap-2 font-semibold ${accent}`}>
              <Icon className="h-4 w-4" /> {label}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => generate(key)} disabled={regenerating === key}>
              {regenerating === key ? <><OwlMark size={14} /> …</> : <><RotateCw className="h-3.5 w-3.5" /> Refresh</>}
            </Button>
          </div>
          <Textarea
            rows={Math.max(3, sections[key].length + 1)}
            value={sections[key].map((l) => `- ${l}`).join("\n")}
            onChange={(e) => setLines(key, e.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
      ))}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <FileText className="h-3.5 w-3.5" /> Edit any section above, then copy or export. This draft is saved as you go.
      </p>
    </div>
  );
}
