"use client";

import { useState, useRef } from "react";
import { Plus, GripVertical, ListChecks, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatDay } from "@/lib/utils";

export interface TaskDTO {
  id: string;
  title: string;
  priority: "today" | "this_week" | "urgent";
  status: "todo" | "done";
  source: "meeting" | "email" | "jira" | "manual";
  due: string | null;
}

type Filter = "all" | "today" | "this_week" | "urgent";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "urgent", label: "Urgent" },
];

const PRIORITY_LABEL: Record<string, string> = { today: "Today", this_week: "This week", urgent: "Urgent" };

export function TaskList({ initial }: { initial: TaskDTO[] }) {
  const [tasks, setTasks] = useState<TaskDTO[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskDTO["priority"]>("this_week");
  const dragId = useRef<string | null>(null);

  const todo = tasks.filter((t) => t.status === "todo");
  const done = tasks.filter((t) => t.status === "done");
  const visible = filter === "all" ? todo : todo.filter((t) => t.priority === filter);

  async function toggle(task: TaskDTO) {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: next }),
    });
  }

  async function addTask() {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, priority }),
    });
    const data = await res.json();
    if (data.task) setTasks((ts) => [...ts, { ...data.task, due: data.task.due ?? null }]);
  }

  function onDrop(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    setTasks((ts) => {
      const arr = [...ts];
      const fromIdx = arr.findIndex((t) => t.id === from);
      const toIdx = arr.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return ts;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: arr.map((t) => t.id) }),
      });
      return arr;
    });
  }

  return (
    <div>
      {/* Add */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task…"
          className="flex-1 min-w-[180px] border-0 bg-transparent"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskDTO["priority"])}
          className="h-9 rounded-xl border border-border bg-surface-2/60 px-2 text-sm text-fg"
        >
          <option value="urgent">Urgent</option>
          <option value="today">Today</option>
          <option value="this_week">This week</option>
        </select>
        <Button size="sm" onClick={addTask}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-border bg-surface-2/40 p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key ? "bg-primary text-white" : "text-muted hover:text-fg"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* To-do */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
          <ListChecks className="h-8 w-8 text-muted" />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Nothing here. Tasks from your meetings, emails and Jira land automatically — or add one above.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((task) => (
            <li
              key={task.id}
              draggable
              onDragStart={() => (dragId.current = task.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(task.id)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 cursor-grab text-muted/50 group-hover:text-muted" />
              <button
                onClick={() => toggle(task)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border hover:border-primary-soft"
                aria-label="Mark done"
              />
              <span className="flex-1 text-sm">{task.title}</span>
              {task.due && (
                <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
                  <CalendarClock className="h-3.5 w-3.5" /> {formatDay(task.due)}
                </span>
              )}
              {task.priority === "urgent" && <Badge variant="urgent">Urgent</Badge>}
              {task.priority !== "urgent" && <Badge variant="default">{PRIORITY_LABEL[task.priority]}</Badge>}
              <Badge variant={task.source}>{task.source}</Badge>
            </li>
          ))}
        </ul>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Done ({done.length})</p>
          <ul className="space-y-1.5">
            {done.map((task) => (
              <li key={task.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 px-3 py-2.5 opacity-60">
                <button
                  onClick={() => toggle(task)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-success bg-success/20 text-success"
                  aria-label="Mark not done"
                >
                  ✓
                </button>
                <span className="flex-1 text-sm line-through">{task.title}</span>
                <Badge variant={task.source}>{task.source}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
