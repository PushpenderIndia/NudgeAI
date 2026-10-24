import { PageHeader } from "@/components/PagePlaceholder";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { connectionStatus } from "@/lib/connections";
import { getRequestContext } from "@/nudge/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { demo } = await getRequestContext();
  return (
    <div>
      <PageHeader title="Settings" subtitle="Voice, briefing, connections and the demo." />
      <SettingsPanel demo={demo} connections={connectionStatus()} />
    </div>
  );
}
