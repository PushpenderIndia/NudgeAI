"use client";

import { useRouter } from "next/navigation";
import { exitDemo, useDemoMode } from "@/lib/demo-client";
import { cn } from "@/lib/utils";

/** "Demo data" pill with an Exit link; renders nothing outside demo mode. */
export function DemoPill({ className }: { className?: string }) {
  const demo = useDemoMode();
  const router = useRouter();
  if (!demo) return null;

  async function handleExit() {
    await exitDemo();
    router.replace("/");
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 font-medium text-primary-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-soft" />
        Demo data
      </span>
      <button type="button" onClick={handleExit} className="text-muted underline-offset-2 hover:text-fg hover:underline">
        Exit demo
      </button>
    </div>
  );
}
