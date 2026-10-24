/**
 * Demo-mode cookies. `nudge_demo` (httpOnly) holds the session key the server
 * scopes demo data by; `nudge_demo_on` is a readable marker so client code
 * (AuthGate, DemoPill) knows demo mode is active. Safe to import on the client.
 */
export const DEMO_KEY_COOKIE = "nudge_demo"; // same as DEMO_COOKIE in @/nudge/session
export const DEMO_MARKER_COOKIE = "nudge_demo_on";

const MAX_AGE = 60 * 60 * 24 * 7;

type CookieWriter = { set(name: string, value: string, opts: Record<string, unknown>): unknown };

export function newDemoKey() {
  return `demo-${crypto.randomUUID()}`;
}

export function writeDemoCookies(cookies: CookieWriter, key: string) {
  const base = { path: "/", sameSite: "lax", maxAge: MAX_AGE };
  cookies.set(DEMO_KEY_COOKIE, key, { ...base, httpOnly: true });
  cookies.set(DEMO_MARKER_COOKIE, "1", base);
}

export function clearDemoCookies(cookies: CookieWriter) {
  for (const name of [DEMO_KEY_COOKIE, DEMO_MARKER_COOKIE]) cookies.set(name, "", { path: "/", maxAge: 0 });
}

/** Client only: is the demo marker cookie present? */
export function hasDemoMarker() {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith(`${DEMO_MARKER_COOKIE}=1`));
}
