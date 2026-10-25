import { ensureDayStarted } from "@/ai/agent-orchestrator";
import { StartDay } from "@/components/start-day/StartDay";
import { getDataSource } from "@/nudge/datasource";
import { getRequestContext } from "@/nudge/session";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  // Meeting briefs for the Meetings page (kept from the earlier start-of-day flow).
  void ensureDayStarted().catch((error) => console.error("Meeting briefs failed", error));
  // The name is known before the briefing is, so the welcome can greet by name straight away.
  const profile = await (await getDataSource(await getRequestContext())).memory.profile().catch(() => null);
  return <StartDay userName={profile?.name ?? null} />;
}
