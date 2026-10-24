"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { isFinished } from "@/lib/agent-runs";
import { SCENE_IDS, type Intent, type Scene, type SceneScript } from "@/nudge/scenes";
import { lastBriefed, markBriefed, shouldAutoBrief, useVoicePrefs } from "@/nudge/voice/prefs";
import { Caption } from "@/components/briefing/Caption";
import { ControlBar } from "@/components/briefing/ControlBar";
import { InteractionPanel } from "@/components/briefing/InteractionPanel";
import { OwlAvatar, owlStateFor } from "@/components/briefing/OwlAvatar";
import { StatusLine } from "@/components/briefing/StatusLine";
import { useSceneEngine, type InteractionContext, type InteractionResult } from "@/components/briefing/engine/useSceneEngine";
import type { Via } from "@/components/briefing/engine/intents";
import { answer, fetchView, startBriefing, type BriefingView } from "./api";
import { CatchCard } from "./CatchCard";
import { initialOverrides, resolve, type FlowOverrides } from "./flow";
import { TeamStage, WelcomeStage, firstName, greeting, runStatus, type Line } from "./Stage";
import { PickedPlan } from "./PickedPlan";
import { TodoRail } from "./TodoRail";
import { REVEAL, hhmm, refreshSandbox } from "./ui";

type Mode = "loading" | "intro" | "pending" | "briefing" | "settled";

/** Scene 1 stays up at least this long after Start, and until the briefing data is in. */
const TEAM_MIN_MS = 8000;
const TEAM_MAX_MS = 25000;
const FALLBACK_AFTER_MS = 8000;

const rank = (id?: string | null) => (id ? SCENE_IDS.indexOf(id as (typeof SCENE_IDS)[number]) : -1);

const SCENE_STATUS: Partial<Record<string, string>> = {
  catch: "Tracker is checking your PRs…",
  picks: "Planner is ranking your tasks…",
  plan: "Planner is fitting your day around the calendar…",
  standup: "Reporter is drafting your standup…",
  post: "Reporter is getting your standup ready to post…",
  inbox: "Courier is going through your inbox…",
};

/**
 * Today: the voice-guided "Start my day" briefing (Scenes 0–8) and the settled page it
 * leaves behind. Starts (or reuses) today's plan_day run, follows it every 500 ms, and
 * decides from the voice prefs and saved answers whether to brief or show the day.
 */
export function StartDay() {
  const { prefs } = useVoicePrefs();
  const [runId, setRunId] = useState<string | null>(null);
  const [view, setView] = useState<BriefingView | null>(null);
  const [mode, setModeState] = useState<Mode>("loading");
  const [frozen, setFrozen] = useState<SceneScript | null>(null);
  const [holding, setHolding] = useState(false);
  const [startError, setStartError] = useState(false);

  const [overrides, setOverrides] = useState<FlowOverrides | null>(null);
  const [undone, setUndone] = useState<string[]>([]);
  const modeRef = useRef<Mode>("loading");
  const viewRef = useRef<BriefingView | null>(null);
  const runRef = useRef<string | null>(null);
  const startedAt = useRef(0);
  const queuedStart = useRef(false);
  const replayRef = useRef(false);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const patchFlow = useCallback((p: FlowOverrides) => setOverrides((o) => ({ ...(o ?? {}), ...p })), []);
  const markUndone = useCallback((actionId: string) => setUndone((u) => [...u, actionId]), []);

  /* --------------------------- run + polling --------------------------- */

  const onView = useCallback(
    (v: BriefingView) => {
      if (v.run.id !== runRef.current) return;
      viewRef.current = v;
      setView(v);
      if (modeRef.current === "loading") {
        const answered = Object.keys(v.answers ?? {}).length > 0;
        setMode(!answered && shouldAutoBrief(lastBriefed()) ? "intro" : "settled");
      }
      if (modeRef.current === "pending" && v.sceneScript && !queuedStart.current) {
        queuedStart.current = true;
        setFrozen(v.sceneScript);
        setMode("briefing");
      }
    },
    [setMode]
  );

  const refresh = useCallback(async () => {
    const id = runRef.current;
    if (!id) return null;
    const v = await fetchView(id);
    if (v) onView(v);
    return v;
  }, [onView]);

  const openRun = useCallback(
    async (force: boolean) => {
      setStartError(false);
      const started = await startBriefing(force);
      if (!started) {
        setStartError(true);
        if (modeRef.current === "loading") setMode("settled");
        return null;
      }
      runRef.current = started.runId;
      viewRef.current = null;
      setView(null);
      setRunId(started.runId);
      return started.runId;
    },
    [setMode]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void openRun(false), 0);
    return () => window.clearTimeout(timer);
  }, [openRun]);

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      const v = await fetchView(runId);
      if (stopped) return;
      if (v) onView(v);
      if (!v || !isFinished(v.run) || !v.sceneScript) timer = window.setTimeout(tick, 500);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [runId, onView]);

  // No script within 8 s of Start: take the server's fallback (template or committed script).
  useEffect(() => {
    if (mode !== "pending" || !runId) return;
    let stopped = false;
    let timer = window.setTimeout(function retry() {
      void fetchView(runId, true).then((v) => {
        if (stopped) return;
        if (v) onView(v);
        if (modeRef.current === "pending") timer = window.setTimeout(retry, 2000);
      });
    }, Math.max(0, FALLBACK_AFTER_MS - (Date.now() - startedAt.current)));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [mode, runId, onView]);

  /* ------------------------------ engine ------------------------------ */

  const script = frozen ?? view?.sceneScript ?? null;
  const teamIndex = Math.max(0, script?.scenes.findIndex((s) => s.id === "team") ?? 0);
  const engineRef = useRef<ReturnType<typeof useSceneEngine> | null>(null);

  const onInteraction = async (scene: Scene, intent: Intent, via: Via, ctx: InteractionContext): Promise<InteractionResult> => {
    const id = runRef.current;
    const v = viewRef.current;
    const b = v?.briefing ?? null;
    if (!id) return {};

    if (scene.id === "catch") {
      const decision = intent.intent === "confirm" ? "confirm" : "decline";
      if (ctx.replay) {
        patchFlow({ catch: { decision, via } });
        return {};
      }
      // Skip never approves and leaves the move waiting in Needs your OK.
      if (ctx.skipped) {
        patchFlow({ catch: { decision: "decline", via, skipped: true } });
        return {};
      }
      const res = await answer.catch(id, decision, via);
      if (res?.standup) patchFlow({ standup: res.standup });
      const m = b?.mismatch;
      if (decision === "confirm" && res?.ok) {
        patchFlow({ catch: { decision, via, undoUntil: res.undoUntil } });
        refreshSandbox();
        return m ? { speech: `Done. ${m.ticket.key} moves to ${m.suggestedStatus}.`, highlights: [m.ticket.key, m.suggestedStatus] } : {};
      }
      patchFlow({ catch: { decision: "decline", via } });
      return m ? { speech: `Okay, ${m.ticket.key} stays ${m.ticket.status}. I've noted it in your standup.`, highlights: [m.ticket.key] } : {};
    }

    if (scene.id === "picks") {
      const choiceId = intent.choiceId ?? b?.picks[0]?.id;
      if (!choiceId) return {};
      const terms = [...(b?.picks.map((p) => p.id) ?? []), ...(b?.events.map((e) => hhmm(e.start)) ?? [])];
      const lineFor = (speech?: string) => (speech ? { replaceNext: { speech, captionHighlights: terms.filter((t) => speech.includes(t)) } } : {});
      if (ctx.replay) {
        patchFlow({ pickId: choiceId });
        return lineFor(v?.answers.planSpeech);
      }
      engineRef.current?.setStatusLine("Planner", `Planner is fitting ${choiceId} into your day…`);
      const res = await answer.pick(id, choiceId, via);
      if (!res) {
        patchFlow({ pickId: choiceId });
        return {};
      }
      patchFlow({ pickId: choiceId, plan: res.plan, todo: res.todo, standup: res.standup });
      return lineFor(res.speech);
    }
    return {};
  };

  const finish = useCallback(async () => {
    replayRef.current = false;
    await refresh();
    setOverrides(null);
    setFrozen(null);
    setMode("settled");
  }, [refresh, setMode]);

  const engine = useSceneEngine({
    script,
    startIndex: teamIndex,
    prefs,
    replay: view?.answers ?? null,
    handlers: {
      onInteraction,
      onSceneEnd: (scene) => {
        if (scene.id !== "team" || replayRef.current) return;
        const elapsed = Date.now() - startedAt.current;
        if (elapsed < TEAM_MIN_MS || !viewRef.current?.briefing) {
          engineRef.current?.pause();
          setHolding(true);
        }
      },
      onFinish: () => void finish(),
    },
  });
  useEffect(() => {
    engineRef.current = engine;
  });

  // Start once the frozen script is in the engine's options (after Start with no script yet).
  useEffect(() => {
    if (!frozen || !queuedStart.current || modeRef.current !== "briefing") return;
    queuedStart.current = false;
    engineRef.current?.start();
  }, [frozen]);

  // Scene 1 hold: release when the minimum graph time is up and the briefing is saved.
  const briefingReady = Boolean(view?.briefing);
  useEffect(() => {
    if (!holding) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = briefingReady ? Math.max(0, TEAM_MIN_MS - elapsed) : Math.max(0, TEAM_MAX_MS - elapsed);
    const timer = window.setTimeout(() => {
      setHolding(false);
      engineRef.current?.resume();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [holding, briefingReady]);

  /* ------------------------------ actions ------------------------------ */

  const begin = useCallback(() => {
    markBriefed();
    startedAt.current = Date.now();
    replayRef.current = false;
    setOverrides(initialOverrides(viewRef.current?.answers, false));
    const ready = viewRef.current?.sceneScript;
    if (ready) {
      setFrozen(ready);
      setMode("briefing");
      engine.start();
    } else {
      queuedStart.current = false;
      setMode("pending");
    }
  }, [engine, setMode]);

  const skipIntro = useCallback(() => {
    markBriefed();
    queuedStart.current = false;
    if (engine.status !== "idle" && engine.status !== "done") engine.skipAll();
    setMode("settled");
  }, [engine, setMode]);

  /* ------------------------------- render ------------------------------- */

  const b = view?.briefing ?? null;
  const day = resolve(b, view?.answers, mode === "settled" ? null : overrides);
  const current = mode === "briefing" ? engine.current : null;
  const sceneRank = rank(current?.id);
  const owl = owlStateFor(engine.status);
  const name = firstName(b?.userName);
  const welcomeScene = script?.scenes.find((s) => s.id === "welcome");
  const audioHint = engine.audioBlocked ? (
    <button type="button" onClick={engine.unlockAudio} className="mt-3 cursor-pointer text-xs text-primary-soft underline-offset-2 hover:underline">
      Tap to hear Nudge
    </button>
  ) : null;
  const engineLine: Line = { text: engine.caption, highlights: engine.captionHighlights, spokenChars: engine.spokenChars };
  const status = engine.statusLine ?? runStatus(view?.run) ?? (current && SCENE_STATUS[current.id] ? { agent: current.agent, text: SCENE_STATUS[current.id]! } : null);

  let stage: React.ReactNode = null;
  if (mode === "intro" || (mode === "briefing" && current?.id === "welcome")) {
    const line: Line =
      mode === "briefing"
        ? engineLine
        : welcomeScene
          ? { text: welcomeScene.speech, highlights: welcomeScene.captionHighlights }
          : { text: `${greeting()}${name ? `, ${name}` : ""}. Ready to start your day?`, highlights: name ? [name] : [] };
    stage = <WelcomeStage line={line} owl={owl} onStart={mode === "intro" ? begin : undefined} onSkip={skipIntro} audioHint={audioHint} />;
  } else if (mode === "pending" || (mode === "briefing" && (current?.id === "team" || !current))) {
    stage = (
      <TeamStage
        runId={runId}
        run={view?.run ?? null}
        line={current?.id === "team" ? engineLine : null}
        owl={mode === "pending" ? "thinking" : owl}
        status={runStatus(view?.run) ?? (holding ? { agent: "Nudge", text: "Nudge is putting your day together…" } : null)}
        onSkip={replayRef.current ? undefined : skipIntro}
        audioHint={audioHint}
      />
    );
  }

  const briefing = mode === "briefing" && sceneRank >= rank("catch");
  const settled = mode === "settled";
  const reached = (id: string) => settled || sceneRank >= rank(id);

  const picks = b?.picks ?? [];
  let revealedPicks = picks.length;
  if (current?.id === "picks") {
    revealedPicks = 0;
    for (const p of picks) {
      const words = p.ticket.title.split(/[^A-Za-z0-9']+/).filter((w) => w.length >= 5);
      if (engine.isSpoken(p.id) || words.some((w) => engine.isSpoken(w))) revealedPicks++;
      else break;
    }
  }
  const choosing = (current?.id === "picks" && engine.interaction?.type === "choice") || (settled && !day.pickId);
  const pickKeys = new Set(picks.map((p) => p.id));
  const rail = day.pickId
    ? [...new Map([...day.todo, ...picks.map((p) => p.ticket)].map((t) => [t.key, t])).values()].filter((t) => t.key !== day.pickId)
    : day.todo.filter((t) => !pickKeys.has(t.key));
  const choose = (choiceId: string) => {
    if (!settled) return engine.respond({ kind: "click", optionId: choiceId });
    if (!runId) return;
    void answer.pick(runId, choiceId, "click").then(() => refresh());
  };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        {stage}
        {mode !== "loading" && !stage && (
          <div className="space-y-6 pb-28">
            <header className={briefing ? "sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-4 pt-2 backdrop-blur md:-mx-8 md:px-8" : undefined}>
              <div className="flex items-start gap-4">
                <motion.div layoutId="nudge-owl" transition={REVEAL} className="inline-flex shrink-0">
                  <OwlAvatar state={briefing ? owl : "idle"} size={briefing ? 48 : 44} urgent={current?.id === "inbox"} />
                </motion.div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {briefing ? (
                    <Caption text={engine.caption} highlights={engine.captionHighlights} spokenChars={engine.spokenChars} className="text-base md:text-lg" />
                  ) : (
                    <>
                      <h1 className="text-xl font-semibold tracking-tight">
                        {greeting()}
                        {name ? `, ${name}` : ""}
                      </h1>
                      <p className="text-xs text-muted">{new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
                    </>
                  )}
                  <div className="min-h-4">{status && <StatusLine agent={status.agent} text={status.text} />}</div>
                  {briefing && audioHint}
                  {startError && <p className="text-xs text-muted">I couldn&apos;t start planning your day. Try again in a moment.</p>}
                </div>
              </div>
              {briefing && engine.interaction && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={REVEAL} className="mt-4 md:pl-16">
                  <InteractionPanel engine={engine} />
                </motion.div>
              )}
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="min-w-0 space-y-5">
                {briefing && b?.mismatch && sceneRank < rank("wrapup") && (
                  <CatchCard
                    mismatch={b.mismatch}
                    state={day.catch}
                    undone={undone.includes(b.mismatch.pendingActionId)}
                    active={current?.id === "catch"}
                    onUndone={() => markUndone(b.mismatch!.pendingActionId)}
                  />
                )}
                {reached("picks") && (
                  <PickedPlan
                    picks={picks}
                    pickId={day.pickId}
                    plan={day.plan}
                    revealed={revealedPicks}
                    choosing={choosing}
                    showPlan={reached("plan")}
                    picksActive={current?.id === "picks"}
                    planActive={current?.id === "plan"}
                    onChoose={choose}
                  />
                )}
              </div>
              <aside className="min-w-0 space-y-5">{reached("picks") && b && <TodoRail tickets={rail} />}</aside>
            </div>
          </div>
        )}
        {mode === "briefing" && <ControlBar engine={engine} />}
      </LayoutGroup>
    </MotionConfig>
  );
}
