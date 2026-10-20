"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { subscribeToasts, dismissToast, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 animate-fade-up"
        >
          <OwlMark size={22} urgent={t.kind === "nudge"} />
          <p className="flex-1 text-sm text-fg">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} className="text-muted hover:text-fg" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
