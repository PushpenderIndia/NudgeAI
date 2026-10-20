"use client";

import { useState, useRef, useEffect } from "react";
import { PanelRightClose, PanelRightOpen, Send, MessageCircle } from "lucide-react";
import { OwlMark } from "@/components/NudgeLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What do I have today?",
  "Draft my weekly update",
  "Reply to Priya saying I'll send it by Friday",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok) throw new Error("not ready");
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "…" }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I'm not fully wired to your tools yet in this view — try Today, Meetings or Weekly Update to see me work.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
        aria-label="Open Nudge Assistant"
      >
        <PanelRightOpen className="h-5 w-5 text-primary-soft" />
      </button>
    );
  }

  return (
    <aside className="hidden h-dvh w-80 shrink-0 flex-col border-l border-border bg-surface/50 lg:flex">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <OwlMark size={24} />
          <div>
            <p className="text-sm font-semibold">Nudge Assistant</p>
            <p className="text-[11px] text-muted">Ask about your day</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-fg" aria-label="Collapse assistant">
          <PanelRightClose className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Hi — I&apos;m Nudge. I can summarise your day, draft replies and build your weekly update. I&apos;ll always ask before sending anything.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-left text-xs text-fg/90 hover:bg-surface-2"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-primary-soft" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-lg px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-auto bg-primary text-white"
                : "bg-surface-2 text-fg"
            )}
          >
            {m.content}
          </div>
        ))}

        {thinking && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <OwlMark size={18} />
            <span>Give me a moment…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nudge…"
            className="h-10 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || thinking} aria-label="Send">
            <Send className="h-4 w-4 text-primary-soft" />
          </Button>
        </div>
      </form>
    </aside>
  );
}
