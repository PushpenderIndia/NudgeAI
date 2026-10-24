import type { DataSource } from "@/nudge/types";
import { LIVE_SESSION, type RequestContext } from "@/nudge/session";
import { demoDataSource } from "./demo";
import { liveDataSource } from "./live";

export { getDemoState, resetDemoSession } from "./demo";

/** Demo context → per-session sandbox world; live → real integrations. */
export async function getDataSource(ctx: RequestContext): Promise<DataSource> {
  return ctx.demo ? demoDataSource(ctx.sessionKey) : liveDataSource();
}

/** For work outside a request (e.g. executing an approval): "live" or a demo session key. */
export async function getSessionDataSource(sessionKey: string): Promise<DataSource> {
  return getDataSource({ demo: sessionKey !== LIVE_SESSION, sessionKey });
}
