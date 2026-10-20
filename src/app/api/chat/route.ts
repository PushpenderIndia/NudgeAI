import { NextResponse } from "next/server";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { meetings, emails, tasks, pendingActions, activityLog } from "@/db/schema";
import { completeText, NudgeAIError } from "@/ai/client";
import { getSettings } from "@/lib/settings";
import { getRelevantMemories, formatMemories } from "@/ai/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "What can I help you with?" });
  }

  try {
    const settings = await getSettings();
    const mtgs = await db.select().from(meetings).orderBy(asc(meetings.startsAt));
    const urgent = (await db.select().from(emails)).filter((e) => e.triage === "urgent" && !e.isSent);
    const todo = await db.select().from(tasks).where(eq(tasks.status, "todo")).orderBy(asc(tasks.sortOrder));
    const pending = await db.select().from(pendingActions).where(eq(pendingActions.status, "pending"));
    const recent = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(5);
    const memories = await getRelevantMemories(message);

    const context = [
      `User: ${settings.userName}`,
      `Meetings today: ${mtgs.map((m) => m.title).join("; ") || "none"}`,
      `Urgent emails: ${urgent.map((e) => `${e.fromName} — ${e.subject}`).join("; ") || "none"}`,
      `Open tasks: ${todo.slice(0, 8).map((t) => t.title).join("; ") || "none"}`,
      `Awaiting approval: ${pending.length}`,
      `Recently did: ${recent.map((a) => a.summary).join("; ") || "nothing yet"}`,
      "",
      "What you remember:",
      formatMemories(memories),
    ].join("\n");

    const reply = await completeText({
      tier: "heavy",
      system:
        "You are Nudge, a warm, concise AI office buddy. Answer the user's question using ONLY " +
        "the context provided about their day. If they ask you to draft, reply or send something, " +
        "explain they can do it on the matching page (Inbox, Weekly Update, etc.) and that you " +
        "never send anything without their approval. Keep replies short (2-4 sentences). Australian English.",
      user: `Context about my day:\n${context}\n\nMy question: ${message}`,
      maxTokens: 350,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    const msg =
      err instanceof NudgeAIError
        ? err.friendly
        : "I hit a snag just now — try the Inbox, Meetings or Weekly Update pages to see me work.";
    return NextResponse.json({ reply: msg });
  }
}
