"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { NudgeLogo } from "@/components/NudgeLogo";
import { Bell } from "@/components/notifications/Bell";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface/70 px-4 py-3 backdrop-blur">
        <Link href="/today" onClick={() => setOpen(false)}>
          <NudgeLogo variant="full" size={28} />
        </Link>
        <div className="flex items-center gap-2">
          <Bell />
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="text-fg">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid grid-cols-2 gap-1 border-b border-border bg-surface px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
                  active ? "bg-surface-2 text-fg" : "text-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
