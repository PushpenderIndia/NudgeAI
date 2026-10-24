"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SimulateKind = "urgent_email" | "meeting_ended" | "plan_day";

const OPTIONS: { kind: SimulateKind; label: string }[] = [
  { kind: "urgent_email", label: "An urgent email arrives" },
  { kind: "meeting_ended", label: "A meeting just ended" },
  { kind: "plan_day", label: "Plan my day" },
];

/** Demo mode: kick off the real workflows on demand. */
export function SimulateMenu({ onStarted }: { onStarted: (kind: SimulateKind, runId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(kind: SimulateKind) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agents/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const data = await res.json();
      if (!res.ok || !data.runId) throw new Error(data.message ?? "That didn't start.");
      onStarted(kind, data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't start.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && <p className="text-xs text-muted">{error}</p>}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm" disabled={busy}>
            Simulate… <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} className="z-30 w-56 rounded-lg border border-border bg-surface p-1 animate-fade-in">
            <DropdownMenu.Label className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted">Demo</DropdownMenu.Label>
            {OPTIONS.map((option) => (
              <DropdownMenu.Item key={option.kind} onSelect={() => run(option.kind)} className="menu-row cursor-pointer outline-none data-[highlighted]:bg-surface-2">
                {option.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
