"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BriefingAnswers, Intent, Scene, SceneScript } from "@/nudge/scenes";
import { useVoicePrefs } from "@/nudge/voice/prefs";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/briefing/Caption";
import { ControlBar } from "@/components/briefing/ControlBar";
import { InteractionPanel } from "@/components/briefing/InteractionPanel";
import { OwlAvatar, owlStateFor } from "@/components/briefing/OwlAvatar";
import { StatusLine } from "@/components/briefing/StatusLine";
import { useSceneEngine, type InteractionContext, type InteractionResult } from "@/components/briefing/engine/useSceneEngine";
import type { Via } from "@/components/briefing/engine/intents";
import { cn } from "@/lib/utils";

/* HARNESS-ONLY sample data. The real script comes from the server (model or fallback). */
const PICKS = [
  { id: "NUD-150", label: "Fix 500 on /invoices export", spoken: "invoices export", reason: "Due today, customer escalation" },
  { id: "NUD-147", label: "Review Priya's auth refactor PR #209", spoken: "Priya", reason: "Unblocks a teammate" },
  { id: "NUD-153", label: "Add pagination to /orders", spoken: "pagination", reason: "Fits before your 2 pm planning" },
];
const STANDUP = [
  "Yesterday: added retries to the payment webhook (3 commits on feat/webhook-retry).",
  "Yesterday: joined the incident review.",
  "Today: fix the 500 on /invoices export (NUD-150).",
  "Blockers: none.",
];
const HARNESS_SCRIPT: SceneScript = {
  scenes: [
    { id: "welcome", agent: "Nudge", speech: "Morning, Aarav. Give me a moment while my team looks through your day.", captionHighlights: ["Aarav"], reveals: [{ section: "welcome" }] },
    {
      id: "catch",
      agent: "Tracker",
      speech: "You opened PR 212 for NUD-142 yesterday, but the ticket still says To Do. Want me to move it to In Review?",
      captionHighlights: ["PR 212", "NUD-142", "To Do", "In Review"],
      reveals: [{ section: "catch" }],
      interaction: { type: "confirm", pendingActionId: "harness-action" },
    },
    {
      id: "picks",
      agent: "Planner",
      speech: "I'd pick from these three today: the invoices export bug, Priya's auth review, and pagination on orders.",
      captionHighlights: ["invoices export", "Priya", "pagination"],
      reveals: [{ section: "picks", itemIds: PICKS.map((p) => p.id) }],
      interaction: { type: "choice", options: PICKS.map(({ id, label }) => ({ id, label })) },
    },
    { id: "plan", agent: "Planner", speech: "Your plan will appear here once you pick.", captionHighlights: [], reveals: [{ section: "plan" }] },
    {
      id: "standup",
      agent: "Reporter",
      speech: "Here's your standup. Anything you want to change?",
      captionHighlights: [],
      reveals: [{ section: "standup" }],
      interaction: { type: "edit" },
    },
    { id: "post", agent: "Reporter", speech: "Post this to team-standup?", captionHighlights: ["team-standup"], reveals: [{ section: "post" }], interaction: { type: "confirm" } },
    { id: "wrapup", agent: "Nudge", speech: "That's your day. I'm here if anything changes.", captionHighlights: [], reveals: [{ section: "wrapup" }] },
  ],
};
/** Answers the ?auto=1 mode types in, for unattended runs. */
const AUTO_REPLIES: Record<string, string[]> = {
  catch: ["yes please"],
  picks: ["the second one"],
  standup: ["remove the incident review point", "looks good"],
  post: ["not now"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BriefingEngineHarness() {
  const { prefs, update } = useVoicePrefs();
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [standup, setStandup] = useState(STANDUP);
  const [answers, setAnswers] = useState<BriefingAnswers>({});
  const [finished, setFinished] = useState(false);
  const answersRef = useRef<BriefingAnswers>({});
  const standupRef = useRef(STANDUP);

  const note = useCallback((line: string) => setLog((l) => [...l.slice(-40), `${new Date().toLocaleTimeString()}  ${line}`]), []);
  const saveAnswers = (patch: Partial<BriefingAnswers>) => {
    answersRef.current = { ...answersRef.current, ...patch };
    setAnswers(answersRef.current);
  };

  const onInteraction = async (scene: Scene, intent: Intent, via: Via, ctx: InteractionContext): Promise<InteractionResult> => {
    note(`${scene.id}: ${JSON.stringify(intent)} via ${via}${ctx.replay ? " (replay)" : ""}${ctx.skipped ? " (skipped)" : ""}`);
    if (!ctx.replay && !ctx.skipped) await sleep(scene.id === "standup" ? 1200 : 500);
    const v = via === "voice" ? "voice" : via === "text" ? "text" : "click";
    if (scene.id === "catch") {
      if (!ctx.replay) saveAnswers({ catch: { decision: intent.intent === "confirm" ? "confirm" : "decline", via: v } });
      return { speech: intent.intent === "confirm" ? "Done. NUD-142 is now In Review." : "Okay, I'll leave it and mention it in your standup." };
    }
    if (scene.id === "picks" && intent.choiceId) {
      const pick = PICKS.find((p) => p.id === intent.choiceId)!;
      const planSpeech = ctx.replay && answersRef.current.planSpeech
        ? answersRef.current.planSpeech
        : `Okay, ${pick.label} first. You've got until 10:30, then standup, then a clear stretch till 2.`;
      if (!ctx.replay) saveAnswers({ pick: { choiceId: pick.id, via: v }, planSpeech });
      return { replaceNext: { speech: planSpeech, captionHighlights: [pick.id, "10:30"] } };
    }
    if (scene.id === "standup") {
      if (intent.intent === "edit") {
        const before = standupRef.current;
        const after = before.filter((line) => !/incident|meeting/i.test(line));
        standupRef.current = after;
        setStandup(after);
        if (!ctx.replay) {
          const edits = [...(answersRef.current.standupEdits ?? []), { instruction: intent.editInstruction ?? "", before, after }];
          saveAnswers({ standupEdits: edits });
        }
        return { speech: "Done. I removed the incident review line. Anything else?", next: "stay" };
      }
      if (ctx.optionId === "editor") note("standup: would open the text editor");
      if (!ctx.replay) saveAnswers({ standupFinal: standupRef.current });
      return {};
    }
    if (scene.id === "post") {
      if (!ctx.replay) saveAnswers({ post: { decision: intent.intent === "confirm" ? "confirm" : "decline", via: v } });
      return { speech: intent.intent === "confirm" ? "Posted to team-standup." : "Okay, I'll keep the draft here." };
    }
    return {};
  };

  const engine = useSceneEngine({
    script: HARNESS_SCRIPT,
    prefs,
    replay: answers,
    handlers: {
      onInteraction,
      onSceneStart: (scene, i) => {
        note(`scene ${i} start: ${scene.id}`);
        if (i === 0) {
          standupRef.current = STANDUP;
          setStandup(STANDUP);
          setFinished(false);
        }
      },
      onSceneEnd: (scene) => note(`scene end: ${scene.id}`),
      onFinish: () => {
        note("finished");
        setFinished(true);
      },
    },
  });

  // ?auto=1 runs muted and types the canned replies, for unattended checks.
  const autoReplies = useRef<Record<string, string[]>>({});
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") !== "1") return;
    autoReplies.current = structuredClone(AUTO_REPLIES);
    const t = setTimeout(() => {
      setAuto(true);
      if (!engine.muted) engine.toggleMute();
      engine.setSpeed(1.15);
      engine.start();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { status, current, replaying, respond } = engine;
  useEffect(() => {
    if (!auto || status !== "waiting" || !current || replaying) return;
    const reply = autoReplies.current[current.id]?.shift();
    if (!reply) return;
    const t = setTimeout(() => respond({ kind: "text", transcript: reply }), 300);
    return () => clearTimeout(t);
  }, [auto, status, current, replaying, respond]);

  const picksVisible = engine.index >= 2;
  const chosen = answers.pick?.choiceId;

  return (
    <div className="space-y-6 pb-28">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-nudge">Dev harness · sample data only</p>
        <h1 className="mt-1 text-xl font-semibold">Briefing engine</h1>
        <p className="mt-1 text-sm text-muted">
          Runs the scene engine against a hardcoded script with a fake onInteraction. Add <code>?auto=1</code> for an unattended muted run.
        </p>
      </div>

      <section className="card-surface flex flex-col items-center gap-4 px-6 py-8 text-center">
        <OwlAvatar state={owlStateFor(engine.status)} size={88} urgent={current?.id === "catch"} />
        {engine.statusLine ? (
          <StatusLine agent={engine.statusLine.agent} text={engine.statusLine.text} />
        ) : (
          current && <StatusLine agent={current.agent} text={`${current.agent} · scene ${engine.index + 1} of ${engine.total}`} />
        )}
        <div className="min-h-[3.5rem] max-w-xl">
          <Caption text={engine.caption} highlights={engine.captionHighlights} spokenChars={engine.spokenChars} />
        </div>
        {engine.audioBlocked && (
          <button type="button" onClick={engine.unlockAudio} className="cursor-pointer text-xs text-primary-soft underline-offset-2 hover:underline">
            Tap to hear Nudge
          </button>
        )}
        {(engine.status === "idle" || engine.status === "done") && (
          <div className="flex items-center gap-2">
            <Button onClick={engine.start}>{engine.status === "done" ? "Run again" : "Start my day"}</Button>
            {engine.status === "done" && (
              <Button variant="secondary" onClick={() => engine.replay()}>
                Replay with saved answers
              </Button>
            )}
          </div>
        )}
        <div className="w-full max-w-xl text-left">
          <InteractionPanel engine={engine} />
        </div>
      </section>

      {picksVisible && (
        <section className="grid gap-3 md:grid-cols-3">
          {PICKS.map((pick) => {
            const shown = current?.id !== "picks" || engine.isSpoken(pick.spoken);
            return (
              <div
                key={pick.id}
                className={cn(
                  "card-surface p-4 transition-all duration-300",
                  shown ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
                  chosen === pick.id && "border-primary"
                )}
              >
                <p className="text-xs text-muted">{pick.id}</p>
                <p className="mt-1 text-sm font-medium">{pick.label}</p>
                <p className="mt-1 text-xs text-muted">{pick.reason}</p>
              </div>
            );
          })}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card-surface p-4">
          <h2 className="text-sm font-semibold">Standup draft</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {standup.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h2 className="mt-4 text-sm font-semibold">Settings</h2>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={prefs.mutedByDefault} onChange={(e) => update({ mutedByDefault: e.target.checked })} />
            Muted by default (applies on reload)
          </label>
        </div>
        <div className="card-surface p-4">
          <h2 className="text-sm font-semibold">Engine state</h2>
          <pre data-testid="engine-state" className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-muted">
            {JSON.stringify(
              {
                status: engine.status,
                scene: current?.id ?? null,
                index: engine.index,
                spokenChars: engine.spokenChars,
                muted: engine.muted,
                speed: engine.speed,
                audioBlocked: engine.audioBlocked,
                attempts: engine.attempts,
                editCount: engine.editCount,
                editLimitReached: engine.editLimitReached,
                replaying: engine.replaying,
                finished,
                answers,
              },
              null,
              2
            )}
          </pre>
        </div>
      </section>

      <section className="card-surface p-4">
        <h2 className="text-sm font-semibold">Events</h2>
        <pre data-testid="engine-log" className="mt-2 max-h-64 overflow-y-auto text-[11px] leading-relaxed text-muted">
          {log.join("\n")}
        </pre>
      </section>

      <ControlBar engine={engine} />
    </div>
  );
}
