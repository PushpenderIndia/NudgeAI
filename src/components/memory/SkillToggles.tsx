"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface SkillDTO {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export function SkillToggles({ initial }: { initial: SkillDTO[] }) {
  const [skills, setSkills] = useState<SkillDTO[]>(initial);

  async function toggle(id: string, enabled: boolean) {
    setSkills((s) => s.map((x) => (x.id === id ? { ...x, enabled } : x)));
    await fetch("/api/skills/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-soft" />
        <div>
          <h2 className="text-lg font-semibold">Skills</h2>
          <p className="text-sm text-muted">Reusable workflows Nudge can run. Turn a skill off and Nudge won&apos;t use it.</p>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {skills.map((skill) => (
          <div key={skill.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{skill.name}</p>
              <p className="text-sm text-muted">{skill.description}</p>
            </div>
            <Switch checked={skill.enabled} onCheckedChange={(v) => toggle(skill.id, v)} aria-label={`Toggle ${skill.name}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
