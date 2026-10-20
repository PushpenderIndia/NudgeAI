"use client";

import { useState } from "react";
import {
  Plug,
  Shield,
  Download,
  Trash2,
  Clock,
  Mail,
  SquareKanban,
  MessagesSquare,
  GitBranch,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Permission = "read" | "draft" | "act";
type Mode = "demo" | "live";

export interface SettingsDTO {
  mode: Mode;
  userName: string;
  toneDefault: string;
  permissions: Record<string, Permission>;
  reminderSchedule: Record<string, string>;
}

const TOOLS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "teams", label: "Teams / Calendar", icon: MessagesSquare },
  { key: "email", label: "Email", icon: Mail },
  { key: "github", label: "GitHub", icon: GitBranch },
  { key: "jira", label: "Jira", icon: SquareKanban },
];

const PERMS: { key: Permission; label: string }[] = [
  { key: "read", label: "Read only" },
  { key: "draft", label: "Read + draft" },
  { key: "act", label: "Act with approval" },
];

const TONES = ["formal", "friendly", "concise"];

async function patch(body: Record<string, unknown>) {
  await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
            value === o.key ? "bg-primary text-white" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel({ settings }: { settings: SettingsDTO }) {
  const [mode, setMode] = useState<Mode>(settings.mode);
  const [userName, setUserName] = useState(settings.userName);
  const [tone, setTone] = useState(settings.toneDefault);
  const [permissions, setPermissions] = useState(settings.permissions);
  const [schedule, setSchedule] = useState(settings.reminderSchedule);
  const [deleted, setDeleted] = useState(false);
  const [saved, setSaved] = useState(false);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function setPerm(tool: string, perm: Permission) {
    const next = { ...permissions, [tool]: perm };
    setPermissions(next);
    patch({ permissions: { [tool]: perm } }).then(flashSaved);
  }

  function setReminder(key: string, value: string) {
    const next = { ...schedule, [key]: value };
    setSchedule(next);
  }

  async function deleteAll() {
    if (!confirm("Delete all your data? This clears meetings, emails, tasks, drafts and memory. You can restore the demo with `npm run seed`.")) return;
    await fetch("/api/settings/delete-all", { method: "POST" });
    setDeleted(true);
  }

  return (
    <div className="space-y-5">
      {saved && (
        <div className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success animate-fade-up">
          <Check className="h-4 w-4" /> Saved
        </div>
      )}

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-primary-soft" /> Connections</CardTitle>
          <CardDescription>Set how far Nudge can go with each tool. Read-only means it can look but never act.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-nudge" title="Demo data" />
                  <Icon className="h-4 w-4 text-primary-soft" />
                  <span className="text-sm font-medium">{tool.label}</span>
                </div>
                <div className="sm:w-80">
                  <Segmented value={permissions[tool.key] ?? "draft"} options={PERMS} onChange={(p) => setPerm(tool.key, p)} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Data source</CardTitle>
          <CardDescription>Demo data works with no credentials. Live connection needs tokens (see the README).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 p-3">
            <div>
              <p className="text-sm font-medium">{mode === "live" ? "Live connection" : "Demo data"}</p>
              <p className="text-xs text-muted">{mode === "live" ? "Nudge uses your real connected tools." : "Nudge uses realistic sample data."}</p>
            </div>
            <Switch
              checked={mode === "live"}
              onCheckedChange={(v) => {
                const next: Mode = v ? "live" : "demo";
                setMode(next);
                patch({ mode: next }).then(flashSaved);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Your details */}
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>How Nudge greets you and the default tone for drafted replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Your name</label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onBlur={() => patch({ userName }).then(flashSaved)}
              className="max-w-xs"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Default reply tone</label>
            <div className="max-w-xs">
              <Segmented
                value={tone}
                options={TONES.map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1) }))}
                onChange={(t) => {
                  setTone(t);
                  patch({ toneDefault: t }).then(flashSaved);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary-soft" /> Reminders</CardTitle>
          <CardDescription>When Nudge should nudge you. Saved when you click away.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            { key: "timesheet", label: "Timesheet" },
            { key: "eod", label: "End-of-day check-in" },
            { key: "weekly", label: "Weekly report" },
          ].map((r) => (
            <div key={r.key}>
              <label className="mb-1.5 block text-xs font-medium text-muted">{r.label}</label>
              <Input
                value={schedule[r.key] ?? ""}
                onChange={(e) => setReminder(r.key, e.target.value)}
                onBlur={() => patch({ reminderSchedule: { [r.key]: schedule[r.key] ?? "" } }).then(flashSaved)}
                placeholder="e.g. Fri 17:00"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data & privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary-soft" /> Your data & privacy</CardTitle>
          <CardDescription>Your data lives in your own local database. You can take it or delete it any time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/30 p-4 text-sm text-fg/90">
            <p className="mb-2 font-medium text-primary-soft">How Nudge handles your data</p>
            <ul className="space-y-1.5 text-muted">
              <li>• Everything stays in a local database on your machine — nothing is uploaded to Nudge.</li>
              <li>• Only the text needed for a task is sent to the model to do that task.</li>
              <li>• Nudge never sends an email, posts a comment or changes a ticket without your approval.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a href="/api/settings/export" download>
                <Download className="h-4 w-4" /> Export my data
              </a>
            </Button>
            <Button variant="danger" onClick={deleteAll}>
              <Trash2 className="h-4 w-4" /> Delete all my data
            </Button>
          </div>
          {deleted && (
            <p className="text-sm text-muted">
              Your data was cleared. Run <code className="rounded bg-surface-2 px-1.5 py-0.5 text-primary-soft">npm run seed</code> to restore the demo, then refresh.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
