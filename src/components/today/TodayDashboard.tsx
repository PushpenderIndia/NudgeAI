"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  ArrowRight,
  Users,
  Activity as ActivityIcon,
} from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MeetingDTO {
  id: string;
  title: string;
  time: string;
  attendees: number;
}
interface TaskDTO {
  id: string;
  title: string;
  priority: "today" | "this_week" | "urgent";
  source: "meeting" | "email" | "jira" | "manual";
}
interface ActivityDTO {
  action: string;
  summary: string;
  time: string;
}

interface Props {
  userName: string;
  meetings: MeetingDTO[];
  tasks: TaskDTO[];
  pendingCount: number;
  activity: ActivityDTO[];
  fallbackTopPriority: string;
}

export function TodayDashboard({ userName, meetings, tasks, pendingCount, activity, fallbackTopPriority }: Props) {
  const [greeting, setGreeting] = useState("Hello");
  const [brief, setBrief] = useState<string | null>(null);
  const [topPriority, setTopPriority] = useState(fallbackTopPriority);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  async function writeBrief() {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch("/api/skills/morning-brief", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.message ?? "Nudge couldn't write your brief just now.");
      } else {
        setBrief(data.brief);
        if (data.topPriority) setTopPriority(data.topPriority);
      }
    } catch {
      setNote("Nudge couldn't reach its brain just now — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6 flex items-center gap-3">
        <OwlMark size={40} animated />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-muted">Here's your day, handled gently.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Morning brief */}
          <Card className="gradient-hero overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-primary-soft" /> Morning brief
                </h2>
                <p className="mt-0.5 text-xs text-muted">An AI summary of everything that matters today.</p>
              </div>
              <Button size="sm" onClick={writeBrief} disabled={loading}>
                {loading ? (
                  <>
                    <OwlMark size={16} animated /> Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> {brief ? "Rewrite" : "Write my brief"}
                  </>
                )}
              </Button>
            </div>
            {(brief || note) && (
              <div className="animate-fade-up border-t border-border bg-surface-2/20 p-5 text-sm">
                {brief ? <p className="whitespace-pre-wrap text-fg/90">{brief}</p> : <p className="text-muted">{note}</p>}
              </div>
            )}
          </Card>

          {/* Nudge says… */}
          <div className="flex items-start gap-3 rounded-2xl border border-nudge/40 bg-nudge/10 p-4">
            <OwlMark size={18} urgent />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-nudge">Nudge says…</p>
              <p className="mt-0.5 text-sm text-fg/90">{topPriority}</p>
            </div>
          </div>

          {/* Meetings timeline */}
          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-4 w-4 text-primary-soft" /> Today's meetings
              </h2>
              <Link href="/meetings" className="flex items-center gap-1 text-xs text-primary-soft hover:underline">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {meetings.length === 0 ? (
                <p className="text-sm text-muted">No meetings today — enjoy the focus time.</p>
              ) : (
                <ol className="relative ml-1 space-y-4 border-l border-border pl-5">
                  {meetings.map((m) => (
                    <li key={m.id} className="relative">
                      <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <Link href="/meetings" className="block rounded-lg -mx-2 px-2 py-1 hover:bg-surface-2/50">
                        <p className="text-xs text-primary-soft">{m.time}</p>
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <Users className="h-3 w-3" /> {m.attendees} people
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>

          {/* Priority tasks */}
          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <ListChecks className="h-4 w-4 text-primary-soft" /> Top tasks
              </h2>
              <Link href="/tasks" className="flex items-center gap-1 text-xs text-primary-soft hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted">Nothing on your list yet. Nudge will add tasks from meetings and emails.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          t.priority === "urgent" ? "bg-nudge" : t.priority === "today" ? "bg-primary" : "bg-muted/50"
                        )}
                      />
                      <span className="flex-1 text-sm">{t.title}</span>
                      <Badge variant={t.source}>{t.source}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {/* Approvals counter */}
          <Link href="/approvals" className="block">
            <Card
              className={cn(
                "p-5 transition-colors",
                pendingCount > 0 ? "border-nudge/40 bg-nudge/5 hover:bg-nudge/10" : "hover:bg-surface-2/40"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Approvals needed</p>
                  <p className={cn("mt-1 text-2xl font-bold", pendingCount > 0 ? "text-nudge" : "text-success")}>
                    {pendingCount}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {pendingCount > 0 ? `waiting for your OK` : "Nothing to approve"}
                  </p>
                </div>
                <CheckCircle2 className={cn("h-7 w-7", pendingCount > 0 ? "text-nudge" : "text-success")} />
              </div>
            </Card>
          </Link>

          {/* Activity feed */}
          <Card>
            <div className="flex items-center gap-2 p-5 pb-3">
              <ActivityIcon className="h-4 w-4 text-primary-soft" />
              <h2 className="font-semibold">What Nudge did today</h2>
            </div>
            <div className="px-5 pb-5">
              {activity.length === 0 ? (
                <p className="text-sm text-muted">Nudge hasn't done anything yet today — its work will show up here.</p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((a, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
                      <div>
                        <p>
                          <span className="font-medium text-primary-soft">{a.action}</span>{" "}
                          <span className="text-fg/90">{a.summary}</span>
                        </p>
                        <p className="text-xs text-muted">{a.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
