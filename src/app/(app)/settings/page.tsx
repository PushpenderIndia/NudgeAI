import { PageHeader } from "@/components/PagePlaceholder";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Voice, briefing and connections." />
      <SettingsPanel />
    </div>
  );
}
