"use client";

import { useState } from "react";
import { User, FolderKanban, Sliders, PenLine, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MemoryDTO {
  id: string;
  type: "person" | "project" | "preference" | "style";
  content: string;
  source: string;
}

const GROUPS: {
  type: MemoryDTO["type"];
  label: string;
  icon: typeof User;
  badge: "primary" | "meeting" | "default" | "urgent";
  empty: string;
}[] = [
  { type: "person", label: "People", icon: User, badge: "primary", empty: "No people remembered yet." },
  { type: "project", label: "Projects", icon: FolderKanban, badge: "meeting", empty: "No projects remembered yet." },
  { type: "preference", label: "Preferences", icon: Sliders, badge: "default", empty: "No preferences remembered yet." },
  { type: "style", label: "Writing style", icon: PenLine, badge: "urgent", empty: "Nudge will learn your style as you edit drafts." },
];

function sourceLabel(source: string) {
  if (source === "edited-draft") return "learned from an edited draft";
  if (source === "seed") return "seeded";
  if (source === "user") return "you added this";
  return source;
}

export function MemoryCards({ initial }: { initial: MemoryDTO[] }) {
  const [memories, setMemories] = useState<MemoryDTO[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<MemoryDTO["type"]>("person");
  const [newContent, setNewContent] = useState("");

  async function save(id: string) {
    const content = draft.trim();
    if (!content) return;
    setMemories((m) => m.map((x) => (x.id === id ? { ...x, content } : x)));
    setEditingId(null);
    await fetch("/api/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this memory? Nudge will forget it.")) return;
    setMemories((m) => m.filter((x) => x.id !== id));
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function add() {
    const content = newContent.trim();
    if (!content) return;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, content }),
    });
    const data = await res.json();
    if (data.memory) {
      setMemories((m) => [...m, { id: data.memory.id, type: newType, content, source: "user" }]);
      setNewContent("");
      setAdding(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">What Nudge remembers</h2>
          <p className="text-sm text-muted">People, projects, preferences and your writing style. Edit or delete anything.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-4 w-4" /> Add memory
        </Button>
      </div>

      {adding && (
        <div className="mb-5 animate-fade-up space-y-2 rounded-2xl border border-border bg-surface p-4">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as MemoryDTO["type"])}
            className="h-9 rounded-xl border border-border bg-surface-2/60 px-2 text-sm text-fg"
          >
            <option value="person">Person</option>
            <option value="project">Project</option>
            <option value="preference">Preference</option>
            <option value="style">Writing style</option>
          </select>
          <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="e.g. Priya prefers concise updates…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={add}><Check className="h-4 w-4" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((group) => {
          const items = memories.filter((m) => m.type === group.type);
          const Icon = group.icon;
          return (
            <div key={group.type} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary-soft" />
                <h3 className="font-semibold">{group.label}</h3>
                <Badge variant={group.badge} className="ml-auto">{items.length}</Badge>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted">{group.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                      {editingId === m.id ? (
                        <div className="space-y-2">
                          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => save(m.id)}><Check className="h-4 w-4" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group">
                          <p className="text-sm text-fg/90">{m.content}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className={cn("text-[11px] text-muted", m.source === "edited-draft" && "text-nudge")}>{sourceLabel(m.source)}</span>
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button onClick={() => { setEditingId(m.id); setDraft(m.content); }} className="rounded-md p-1 text-muted hover:text-fg" aria-label="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => remove(m.id)} className="rounded-md p-1 text-muted hover:text-danger" aria-label="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
