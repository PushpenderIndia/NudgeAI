import type { WeeklyUpdate } from "@/skills/weekly-update";

const SECTIONS: { key: keyof WeeklyUpdate; label: string }[] = [
  { key: "highlights", label: "Highlights" },
  { key: "progress", label: "Progress" },
  { key: "blockers", label: "Blockers" },
  { key: "nextWeek", label: "Next week" },
];

export function weeklyToMarkdown(sections: WeeklyUpdate): string {
  const lines: string[] = ["# Weekly Update", ""];
  for (const { key, label } of SECTIONS) {
    lines.push(`## ${label}`);
    const items = sections[key] ?? [];
    if (items.length === 0) {
      lines.push("- —");
    } else {
      for (const item of items) lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
