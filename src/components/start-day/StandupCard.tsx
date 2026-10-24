"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Hash } from "lucide-react";
import { STANDUP_CHANNEL, type StandupDraft } from "@/nudge/briefing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConfirmState } from "./flow";
import { STANDUP_SECTIONS, plainToStandup, standupToPlain, type DiffLine } from "./standup";
import { REVEAL, Section, UndoButton, hhmm } from "./ui";

const LINE_STAGGER = 0.28;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg transition-colors hover:bg-surface-2"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DiffView({ diff }: { diff: DiffLine[] }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Changes to your standup">
      {diff.map((line, i) =>
        /:$/.test(line.text) && line.kind === "same" ? (
          <li key={i} className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted first:pt-0">
            {line.text.replace(/:$/, "")}
          </li>
        ) : (
          <motion.li
            key={i}
            initial={line.kind === "added" ? { opacity: 0, x: -4 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={REVEAL}
            className={cn(
              "rounded px-2 py-0.5",
              line.kind === "removed" && "text-muted line-through decoration-muted/70",
              line.kind === "added" && "bg-primary/15 text-fg",
              line.kind === "same" && "text-fg/85"
            )}
          >
            <span aria-hidden className="mr-1.5 inline-block w-2 text-muted">
              {line.kind === "removed" ? "−" : line.kind === "added" ? "+" : "·"}
            </span>
            {line.text}
          </motion.li>
        )
      )}
    </ul>
  );
}

function Editor({ standup, onSave, onCancel }: { standup: StandupDraft; onSave: (s: StandupDraft) => void; onCancel: () => void }) {
  const [text, setText] = useState(() => standupToPlain(standup));
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        aria-label="Edit your standup"
        autoFocus
        className="w-full rounded-lg border border-border bg-surface-2/40 p-3 font-mono text-xs leading-relaxed text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onSave(plainToStandup(text))}>
          Save standup
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto text-[11px] text-muted">Keep the Yesterday / Today / Blockers headings.</span>
      </div>
    </div>
  );
}

/**
 * Standup: builds line by line (Yesterday / Today / Blockers) when first shown, shows the
 * redraft diff briefly after each edit, and ends as posted (with Undo) or a draft with Copy.
 */
export function StandupCard({
  standup,
  diff,
  build,
  editor,
  onEditorSave,
  onEditorCancel,
  active,
  post,
  postUndone,
  postedAt,
  actionId,
  onPostUndone,
}: {
  standup: StandupDraft;
  diff: DiffLine[] | null;
  /** Stagger the lines in as the section first appears. */
  build: boolean;
  editor: boolean;
  onEditorSave: (s: StandupDraft) => void;
  onEditorCancel: () => void;
  active: boolean;
  post: ConfirmState | null;
  postUndone: boolean;
  postedAt?: string | null;
  actionId?: string | null;
  onPostUndone: () => void;
}) {
  const posted = post?.decision === "confirm" && !postUndone;
  const [stagger, setStagger] = useState(build);
  useEffect(() => {
    if (!stagger) return;
    const timer = window.setTimeout(() => setStagger(false), 4000);
    return () => window.clearTimeout(timer);
  }, [stagger]);

  let order = 0;
  const aside = posted ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <Hash className="h-3 w-3" />
      Posted to {STANDUP_CHANNEL}
      {postedAt && <span className="tabular-nums">· {hhmm(postedAt)}</span>}
    </span>
  ) : (
    <>
      <span className="text-xs text-muted">Draft</span>
      <CopyButton text={standupToPlain(standup)} />
    </>
  );

  return (
    <Section title="Standup" active={active} aside={aside}>
      {editor ? (
        <Editor standup={standup} onSave={onEditorSave} onCancel={onEditorCancel} />
      ) : diff ? (
        <DiffView diff={diff} />
      ) : (
        <div className="space-y-3">
          {STANDUP_SECTIONS.map(({ key, title }) => {
            const lines = standup[key].length ? standup[key] : key === "blockers" ? ["None"] : [];
            return (
              <div key={key}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => {
                      const delay = stagger ? order++ * LINE_STAGGER : 0;
                      return (
                        <motion.li
                          key={line}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ ...REVEAL, delay }}
                          className={cn("leading-relaxed", line === "None" ? "text-muted" : "text-fg/85")}
                        >
                          {line}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence initial={false}>
        {post && (
          <motion.div
            key={`${post.decision}-${postUndone}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={REVEAL}
            className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm"
          >
            {posted ? (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-fg">
                  <Check className="h-3 w-3" />
                </span>
                <span>
                  Posted to {STANDUP_CHANNEL} · approved {post.via === "voice" ? "by voice" : "by click"}
                </span>
                {actionId && (
                  <span className="ml-auto">
                    <UndoButton actionId={actionId} until={post.undoUntil} onUndone={onPostUndone} />
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted">{postUndone ? "Post undone." : "Not posted."} The draft stays here for you to copy.</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
