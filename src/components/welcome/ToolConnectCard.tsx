"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Permission = "read" | "draft" | "act";

const LEVELS: { key: Permission; label: string; hint: string }[] = [
  { key: "read", label: "Read only", hint: "Nudge can look, nothing else" },
  { key: "draft", label: "Read + draft", hint: "Can prepare drafts for you" },
  { key: "act", label: "Act with approval", hint: "Can act — only after your OK" },
];

export function ToolConnectCard({
  label,
  description,
  icon: Icon,
  defaultPermission = "draft",
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  defaultPermission?: Permission;
}) {
  const [perm, setPerm] = useState<Permission>(defaultPermission);
  const active = LEVELS.find((l) => l.key === perm)!;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2">
          <Icon className="h-5 w-5 text-primary-soft" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{label}</p>
          <p className="truncate text-xs text-muted">{description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setPerm(l.key)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
              perm === l.key ? "bg-primary text-white" : "text-muted hover:text-fg"
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">{active.hint}</p>
    </div>
  );
}
