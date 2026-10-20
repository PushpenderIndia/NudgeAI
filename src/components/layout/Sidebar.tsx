"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { NudgeLogo } from "@/components/NudgeLogo";
import { ConnectionDots } from "@/components/layout/ConnectionDots";
import { Bell } from "@/components/notifications/Bell";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="gradient-sidebar hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
      <div className="flex items-center justify-between px-2">
        <Link href="/today">
          <NudgeLogo variant="full" size={34} />
        </Link>
        <Bell />
      </div>

      <nav className="mt-7 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-surface-2 text-fg glow-primary"
                  : "text-muted hover:bg-surface-2/50 hover:text-fg"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary-soft" : "text-muted group-hover:text-fg")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-border bg-surface/60 p-3">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Connections</p>
        <ConnectionDots />
      </div>
    </aside>
  );
}
