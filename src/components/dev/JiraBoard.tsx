"use client";

import { SquareKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClosingCommentCard } from "./ClosingCommentCard";

export interface JiraDTO {
  key: string;
  summary: string;
  status: string;
  url: string;
  doneToday: boolean;
}

const COLUMNS = ["To Do", "In Progress", "In Review", "Blocked", "Done"];

const STATUS_VARIANT: Record<string, "default" | "primary" | "danger" | "success"> = {
  "To Do": "default",
  "In Progress": "primary",
  "In Review": "primary",
  Blocked: "danger",
  Done: "success",
};

export function JiraBoard({ issues }: { issues: JiraDTO[] }) {
  const byStatus = (status: string) => issues.filter((i) => i.status === status);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <SquareKanban className="h-4 w-4 text-primary-soft" />
        <h2 className="font-semibold">Assigned Jira tickets</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = byStatus(col);
          if (items.length === 0) return null;
          return (
            <div key={col} className="rounded-lg border border-border bg-surface/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[col] ?? "default"}>{col}</Badge>
                <span className="text-xs text-muted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((issue) => (
                  <div key={issue.key} className="rounded-xl border border-border bg-surface p-3">
                    <a href={issue.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary-soft hover:underline">
                      {issue.key}
                    </a>
                    <p className="mt-0.5 text-sm text-fg/90">{issue.summary}</p>
                    {issue.doneToday && <ClosingCommentCard issueKey={issue.key} />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
