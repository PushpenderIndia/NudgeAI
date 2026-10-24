import type { DataSource } from "@/nudge/types";
import type { RequestContext } from "@/nudge/session";

/** Demo context → per-session sandbox world; live → real integrations. */
export async function getDataSource(ctx: RequestContext): Promise<DataSource> {
  throw new Error(`DataSource for ${ctx.demo ? "demo" : "live"} mode is not implemented yet`);
}
