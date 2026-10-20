import { asc } from "drizzle-orm";
import { db } from "@/db";
import { memories, skills } from "@/db/schema";
import { PageHeader } from "@/components/PagePlaceholder";
import { MemoryCards, type MemoryDTO } from "@/components/memory/MemoryCards";
import { SkillToggles, type SkillDTO } from "@/components/memory/SkillToggles";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const memRows = await db.select().from(memories).orderBy(asc(memories.type));
  const skillRows = await db.select().from(skills).orderBy(asc(skills.sortOrder));

  const memDTO: MemoryDTO[] = memRows.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    source: m.source,
  }));

  const skillDTO: SkillDTO[] = skillRows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    enabled: s.enabled,
  }));

  return (
    <div>
      <PageHeader
        title="Memory & Skills"
        subtitle="What Nudge remembers about you, and the skills it can run. Edit or delete anything."
      />
      <MemoryCards initial={memDTO} />
      <SkillToggles initial={skillDTO} />
    </div>
  );
}
