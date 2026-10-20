import { db } from "@/db";
import { memories } from "@/db/schema";
import type { Memory, MemoryType } from "@/db/schema";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are",
  "i", "my", "me", "you", "your", "it", "this", "that", "at", "by", "be", "will",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Lightweight keyword retrieval: score each memory by token overlap with the
 * query context and return the top matches' content.
 */
export async function getRelevantMemories(context: string, limit = 6): Promise<Memory[]> {
  const all = await db.select().from(memories);
  const q = new Set(tokens(context));
  if (q.size === 0) return all.slice(0, limit);

  const scored = all.map((m) => {
    const mt = tokens(m.content);
    let score = 0;
    for (const t of mt) if (q.has(t)) score++;
    // Always nudge preferences/style slightly up so tone is respected.
    if (m.type === "preference" || m.type === "style") score += 0.5;
    return { m, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.m);
}

export function formatMemories(mem: Memory[]): string {
  if (mem.length === 0) return "(no stored notes yet)";
  return mem.map((m) => `- [${m.type}] ${m.content}`).join("\n");
}

export async function saveMemory(input: { type: MemoryType; content: string; source?: string }) {
  const [row] = await db
    .insert(memories)
    .values({ type: input.type, content: input.content, source: input.source ?? "nudge" })
    .returning();
  return row;
}

export async function updateMemory(id: string, content: string) {
  await db.update(memories).set({ content, updatedAt: new Date() }).where(eqId(id));
}

export async function deleteMemory(id: string) {
  await db.delete(memories).where(eqId(id));
}

// Local helper to avoid importing eq at call sites
import { eq } from "drizzle-orm";
function eqId(id: string) {
  return eq(memories.id, id);
}
