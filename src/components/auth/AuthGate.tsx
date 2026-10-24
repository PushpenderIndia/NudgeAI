"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isDemoAuthenticated } from "@/lib/auth";
import { hasDemoMarker } from "@/lib/demo-cookies";

const subscribe = () => () => {};
// Demo-mode browsers (Try the demo, ?demo=1) are let in with no login.
const isSignedIn = () => isDemoAuthenticated() || hasDemoMarker();

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authenticated = useSyncExternalStore(subscribe, isSignedIn, () => false);

  useEffect(() => {
    // Re-check storage: the hydration render always sees the server snapshot (false).
    if (!authenticated && !isDemoAuthenticated()) {
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
