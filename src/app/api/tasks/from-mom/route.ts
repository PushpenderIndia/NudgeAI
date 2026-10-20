import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ActionItem {
  title: string;
  owner?: string;
  due?: string;
}

export async function POST(req: Request) {
  const { meetingId, meetingTitle, actionItems } = (await req.json()) as {
    meetingId?: string;
    meetingTitle?: string;
    actionItems: ActionItem[];
  };

  if (!Array.isArray(actionItems) || actionItems.length === 0) {
    return NextResponse.json({ error: "empty", message: "No action items to add." }, { status: 400 });
  }

  const rows = actionItems.map((item, i) => {
    const dueLc = (item.due ?? "").toLowerCase();
    const priority = dueLc.includes("today") ? ("today" as const) : ("this_week" as const);
    const title = item.owner ? `${item.title} (${item.owner})` : item.title;
    return {
      title,
      priority,
      source: "meeting" as const,
      sourceId: meetingId,
      sortOrder: Date.now() + i,
    };
  });

  await db.insert(tasks).values(rows);
  await logActivity({
    action: "Created tasks",
    summary: `Added ${rows.length} task${rows.length === 1 ? "" : "s"} from "${meetingTitle ?? "a meeting"}"`,
    entityType: "meeting",
    entityId: meetingId,
  });

  return NextResponse.json({ created: rows.length });
}
