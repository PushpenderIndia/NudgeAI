import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jiraIssues, gitActivity } from "@/db/schema";
import { runSkill } from "@/ai/orchestrator";
import { jiraClosingCommentSkill } from "@/skills/jira-closing-comment";
import { NudgeAIError } from "@/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { issueKey } = await req.json();
  const issue = await db.select().from(jiraIssues).where(eq(jiraIssues.key, issueKey)).get();
  if (!issue) {
    return NextResponse.json({ error: "not_found", message: "Ticket not found." }, { status: 404 });
  }

  try {
    const recentWork = (await db.select().from(gitActivity))
      .filter((g) => g.type === "commit")
      .map((g) => g.title);

    const draft = await runSkill(jiraClosingCommentSkill, {
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      recentWork,
    });
    return NextResponse.json(draft);
  } catch (err) {
    if (err instanceof NudgeAIError) {
      return NextResponse.json({ error: err.code, message: err.friendly }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "unknown", message: "Couldn't draft a closing comment just now." }, { status: 500 });
  }
}
