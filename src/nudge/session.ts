import { cookies } from "next/headers";

/**
 * Demo mode is per browser: the `nudge_demo` cookie holds a random session key
 * (set by `?demo=1` or "Try the demo"). No cookie means live mode.
 */
export const DEMO_COOKIE = "nudge_demo";
export const LIVE_SESSION = "live";

export type RequestContext = { demo: boolean; sessionKey: string };

export async function getRequestContext(): Promise<RequestContext> {
  const key = (await cookies()).get(DEMO_COOKIE)?.value;
  return key ? { demo: true, sessionKey: key } : { demo: false, sessionKey: LIVE_SESSION };
}
