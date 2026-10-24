import { ensureDayStarted } from "@/ai/agent-orchestrator";
import { StartDay } from "@/components/start-day/StartDay";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  // Meeting briefs for the Meetings page (kept from the earlier start-of-day flow).
  void ensureDayStarted().catch((error) => console.error("Meeting briefs failed", error));
  return <StartDay />;
}
