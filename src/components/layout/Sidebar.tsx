"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { NudgeLogo } from "@/components/NudgeLogo";
import { Bell } from "@/components/notifications/Bell";
import { DemoPill } from "@/components/demo/DemoPill";
import { cn } from "@/lib/utils";
import { signOutDemo } from "@/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleSignOut() {
    signOutDemo();
    router.replace("/");
  }

  return (
    <aside className="gradient-sidebar hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
      <div className="flex items-center justify-between px-2">
        <Link href="/today">
          <NudgeLogo variant="full" size={34} />
        </Link>
        <Bell />
      </div>
      <DemoPill className="mt-4 px-2" />

      <nav className="mt-7 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                active
                  ? "bg-surface-2 text-fg"
                  : "text-muted hover:bg-surface-2/50 hover:text-fg"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary-soft" : "text-muted group-hover:text-fg")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2/60 hover:text-fg"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
