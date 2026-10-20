import { NextResponse } from "next/server";
import { db } from "@/db";
import { gitActivity, jiraIssues } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { jiraUpdateSuggesterSkill } from "@/skills/jira-update-suggester";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const git = await db.select().from(gitActivity);
    const commits = git.filter((r) => r.type === "commit").map((r) => ({ repo: r.repo, title: r.title }));
    const issues = (await db.select().from(jiraIssues)).map((i) => ({ key: i.key, summary: i.summary, status: i.status }));

    const result = await runSkill(jiraUpdateSuggesterSkill, { commits, issues });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't suggest Jira updates just now." }, { status: 500 });
  }
}
