import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/PagePlaceholder";
import { SettingsPanel, type SettingsDTO } from "@/components/settings/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  const dto: SettingsDTO = {
    mode: s.mode,
    userName: s.userName,
    toneDefault: s.toneDefault,
    permissions: s.permissions,
    reminderSchedule: s.reminderSchedule,
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Connections, permissions, reminders, and your preferences."
      />
      <SettingsPanel settings={dto} />
    </div>
  );
}
