"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isDemoAuthenticated } from "@/lib/auth";

const subscribe = () => () => {};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authenticated = useSyncExternalStore(subscribe, isDemoAuthenticated, () => false);

  useEffect(() => {
    if (!authenticated) {
      router.replace("/");
    }
  }, [authenticated, router]);

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-sm text-muted">Opening your Nudge workspace…</p>
      </div>
    );
  }

  return children;
}
