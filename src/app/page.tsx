"use client";

import Link from "next/link";
import {
  Plug,
  Eye,
  CheckCheck,
  Check,
  X,
  Mail,
  GitBranch,
  SquareKanban,
  MessagesSquare,
  ArrowRight,
} from "lucide-react";
import { NudgeLogo, OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { ToolConnectCard } from "@/components/welcome/ToolConnectCard";

const STEPS = [
  { icon: Plug, title: "Connect your tools", body: "Teams, Email, GitHub and Jira — or just try the demo." },
  { icon: Eye, title: "Nudge watches your day", body: "Meetings, emails, commits and tickets, quietly tracked." },
  { icon: CheckCheck, title: "You approve, Nudge does the work", body: "Drafts, minutes and tasks — nothing sent without your OK." },
];

const CAN = [
  "Summarise meetings into minutes & action items",
  "Draft email replies in your tone",
  "Build one to-do list from every tool",
  "Write your weekly update from the week's work",
  "Remind you about timesheets & check-ins",
];

const CANNOT = [
  "Send an email without your approval",
  "Post a Jira comment or change a ticket on its own",
  "Share your data with anyone — it stays in your database",
  "Act on a tool you've set to read-only",
];

export default function Welcome() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 py-10 md:py-16">
      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden rounded-3xl border border-border px-6 py-12 text-center md:px-12 md:py-16">
        <div className="mx-auto mb-6 flex justify-center">
          <OwlMark size={84} animated />
        </div>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight md:text-5xl">
          Your work, handled. <span className="text-primary-soft">Gently.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted md:text-lg">
          Nudge is a private, always-on AI office buddy. It tracks your meetings, drafts your
          replies, builds your to-do list and writes your weekly update — and never sends or
          changes anything without your OK.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/today">
              Try with demo data <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/settings">Connect my tools</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">No credentials needed for the demo — just explore.</p>
      </section>

      {/* 3 steps */}
      <section className="mt-12">
        <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-wider text-muted">How Nudge works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="rounded-2xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-soft">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Can / Cannot */}
      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-success">
            <Check className="h-5 w-5" /> What Nudge can do
          </h3>
          <ul className="space-y-2">
            {CAN.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-fg/90">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-nudge/30 bg-nudge/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-nudge">
            <X className="h-5 w-5" /> What Nudge will never do
          </h3>
          <ul className="space-y-2">
            {CANNOT.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-fg/90">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-nudge" /> {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted">
            Nudge never sends emails, posts comments, or changes tickets without your OK.
          </p>
        </div>
      </section>

      {/* Tool connection */}
      <section className="mt-12">
        <div className="mb-5 text-center">
          <h2 className="text-lg font-semibold">Choose what Nudge can touch</h2>
          <p className="mt-1 text-sm text-muted">Set a permission level per tool. You can change these any time in Settings.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToolConnectCard label="Teams / Calendar" description="Meetings & transcripts" icon={MessagesSquare} />
          <ToolConnectCard label="Email" description="Read & draft replies" icon={Mail} />
          <ToolConnectCard label="GitHub" description="Commits, PRs & reviews" icon={GitBranch} defaultPermission="read" />
          <ToolConnectCard label="Jira" description="Assigned issues & comments" icon={SquareKanban} />
        </div>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/today">
              Start with demo data <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="mt-14 flex items-center justify-center gap-2 text-xs text-muted">
        <NudgeLogo variant="icon" size={18} /> Nudge · private by design · powered by NVIDIA Nemotron on Nebius Token Factory
      </footer>
    </div>
  );
}
