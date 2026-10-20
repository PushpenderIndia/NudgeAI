import { NextResponse } from "next/server";
import { db } from "@/db";
import { gitActivity } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { githubDailyDigestSkill } from "@/skills/github-daily-digest";
import { logActivity } from "@/lib/activity";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const rows = await db.select().from(gitActivity);
    const commits = rows.filter((r) => r.type === "commit").map((r) => ({ repo: r.repo, title: r.title }));
    const prs = rows.filter((r) => r.type === "pr").map((r) => ({ repo: r.repo, title: r.title }));

    const digest = await runSkill(githubDailyDigestSkill, { commits, prs });

    await logActivity({ action: "Summarised your dev work", summary: "Turned today's commits & PRs into a progress summary" });
    return NextResponse.json(digest);
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't summarise your dev work just now." }, { status: 500 });
  }
}
