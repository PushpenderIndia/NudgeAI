"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { resetDemo, useDemoMode } from "@/lib/demo-client";

/** Restores the starting demo story. Reloads by default so every view starts clean. */
export function ResetDemoButton({ reload = true, onReset, ...props }: ButtonProps & { reload?: boolean; onReset?: () => void }) {
  const demo = useDemoMode();
  const [busy, setBusy] = useState(false);
  if (!demo) return null;

  async function handleReset() {
    setBusy(true);
    const ok = await resetDemo();
    setBusy(false);
    if (!ok) return;
    onReset?.();
    if (reload) window.location.reload();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReset} disabled={busy} {...props}>
      <RotateCcw className="h-3.5 w-3.5" />
      {busy ? "Resetting…" : "Reset demo"}
    </Button>
  );
}
