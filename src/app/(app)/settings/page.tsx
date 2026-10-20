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
        title="Settings & Privacy"
        subtitle="Decide what Nudge can touch, how it sounds, and what happens to your data. You're always in control."
      />
      <SettingsPanel settings={dto} />
    </div>
  );
}
