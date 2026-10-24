"use client";

import { useSyncExternalStore } from "react";
import { hasDemoMarker } from "@/lib/demo-cookies";
import { signInDemo, signOutDemo } from "@/lib/auth";

/** Fired on window when demo mode turns on/off, or the sandbox data should refetch. */
export const DEMO_CHANGE_EVENT = "nudge:demo-change";
export const SANDBOX_REFRESH_EVENT = "nudge:sandbox-refresh";

function subscribe(cb: () => void) {
  window.addEventListener(DEMO_CHANGE_EVENT, cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(DEMO_CHANGE_EVENT, cb);
    window.removeEventListener("focus", cb);
  };
}

export function useDemoMode() {
  return useSyncExternalStore(subscribe, hasDemoMarker, () => false);
}

/** Starts (or resumes) this browser's demo session. */
export async function startDemo(): Promise<string | null> {
  const res = await fetch("/api/demo/start", { method: "POST" });
  if (!res.ok) return null;
  const { sessionKey } = (await res.json()) as { sessionKey: string };
  signInDemo();
  window.dispatchEvent(new Event(DEMO_CHANGE_EVENT));
  return sessionKey;
}

export async function exitDemo() {
  await fetch("/api/demo/exit", { method: "POST" });
  signOutDemo();
  window.dispatchEvent(new Event(DEMO_CHANGE_EVENT));
}

export async function resetDemo(): Promise<boolean> {
  const res = await fetch("/api/demo/reset", { method: "POST" });
  window.dispatchEvent(new Event(SANDBOX_REFRESH_EVENT));
  return res.ok;
}
