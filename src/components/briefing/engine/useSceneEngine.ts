"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentName } from "@/nudge/types";
import type { BriefingAnswers, Intent, Interaction, Scene, SceneScript } from "@/nudge/scenes";
import { CaptionProvider, createVoice, type VoiceProvider } from "@/nudge/voice";
import type { VoicePrefs, VoiceRate } from "@/nudge/voice/prefs";
import { useSpeechRecognition } from "@/nudge/voice/useSpeechRecognition";
import {
  answersToIntents,
  defaultOptionId,
  intentFromOption,
  interactionOptions,
  parseIntent,
  safeDefaultIntent,
  type InteractionOption,
  type ReplayStep,
  type RespondInput,
  type Via,
} from "./intents";

export type EngineStatus = "idle" | "speaking" | "waiting" | "listening" | "thinking" | "paused" | "done";

export type InteractionContext = {
  via: Via;
  /** True during Replay: use saved answers (answers.planSpeech etc.), never call the model. */
  replay: boolean;
  /** True when Skip scene / Skip all applied the safe default. */
  skipped: boolean;
  /** The clicked button, e.g. "editor" for Open editor. */
  optionId?: string;
  /** Edits already applied in this scene (before this one). */
  editCount: number;
  index: number;
};

export type InteractionResult = {
  /** Line Nudge speaks after the answer (plan sentence, redraft summary). */
  speech?: string;
  highlights?: string[];
  /** "stay" keeps the interaction open (standup redraft loop). Defaults: edit → stay, else advance. */
  next?: "advance" | "stay";
  /** Merged into the next scene before it plays (e.g. the dynamic plan line). */
  replaceNext?: Partial<Scene>;
};

export type SceneEngineHandlers = {
  onInteraction(scene: Scene, intent: Intent, via: Via, ctx: InteractionContext): Promise<InteractionResult | void>;
  onSceneStart?(scene: Scene, index: number): void;
  onSceneEnd?(scene: Scene, index: number): void;
  onFinish?(): void;
};

export type SceneEngineOptions = {
  script: SceneScript | null;
  startIndex?: number;
  prefs?: Partial<Pick<VoicePrefs, "voiceURI" | "rate" | "mutedByDefault">>;
  handlers: SceneEngineHandlers;
  /** Saved answers; replay() uses them (falling back to answers recorded this session). */
  replay?: BriefingAnswers | null;
  intentEndpoint?: string;
  maxEdits?: number;
  /** Pause before a replayed answer is applied, so the UI can show it. */
  replayDelayMs?: number;
};

export type StatusLineState = { agent: AgentName; text: string } | null;

type State = {
  status: Exclude<EngineStatus, "listening" | "paused">;
  current: Scene | null;
  index: number;
  caption: string;
  captionHighlights: string[];
  spokenChars: number;
  /** Progress through the current scene's own speech (never resets on follow-up lines). */
  sceneChars: number;
  interaction: Interaction | null;
  muted: boolean;
  speed: VoiceRate;
  audioBlocked: boolean;
  attempts: number;
  clickOnly: boolean;
  editCount: number;
  editLimitReached: boolean;
  replaying: boolean;
  paused: boolean;
  statusLine: StatusLineState;
};

const SKIP = Symbol("skip");
type Input = RespondInput | typeof SKIP;

export const SORRY_LINE = "Sorry, I didn't catch that.";
export const EDIT_LIMIT_LINE = "That's three changes. Open the editor for anything else, or say looks good.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Plays a SceneScript: speaks each scene (TTS or timed captions), opens its interaction and
 * waits for a click, typed or spoken answer, hands the parsed intent to handlers.onInteraction,
 * then moves on. See src/components/briefing/README.md.
 */
export function useSceneEngine(options: SceneEngineOptions) {
  const { script, prefs, maxEdits = 3, replayDelayMs = 700 } = options;
  const recognition = useSpeechRecognition();

  const [state, setState] = useState<State>(() => ({
    status: "idle",
    current: null,
    index: -1,
    caption: "",
    captionHighlights: [],
    spokenChars: 0,
    sceneChars: 0,
    interaction: null,
    muted: prefs?.mutedByDefault ?? false,
    speed: prefs?.rate ?? 1,
    audioBlocked: false,
    attempts: 0,
    clickOnly: false,
    editCount: 0,
    editLimitReached: false,
    replaying: false,
    paused: false,
    statusLine: null,
  }));
  const patch = useCallback((p: Partial<State>) => setState((s) => ({ ...s, ...p })), []);

  const opts = useRef(options);
  const rec = useRef(recognition);
  useEffect(() => {
    opts.current = options;
    rec.current = recognition;
  });

  const gen = useRef(0);
  const provider = useRef<VoiceProvider | null>(null);
  const muted = useRef(state.muted);
  const speed = useRef<VoiceRate>(state.speed);
  const status = useRef<State["status"]>("idle");
  const paused = useRef(false);
  const resumeWaiters = useRef<(() => void)[]>([]);
  const speaking = useRef(false);
  const switching = useRef(false);
  const lineAbort = useRef(false);
  const skipScene = useRef(false);
  const skipAll = useRef(false);
  const spoken = useRef(0);
  const inputs = useRef<Input[]>([]);
  const inputWaiter = useRef<((input: Input) => void) | null>(null);
  const currentScene = useRef<Scene | null>(null);
  const overrides = useRef<Record<number, Partial<Scene>>>({});
  const recorded = useRef<Record<string, ReplayStep[]>>({});
  const replaying = useRef(false);
  const listenRef = useRef<() => void>(() => {});

  // Keep a scene's prefs in sync when Settings change outside a run.
  useEffect(() => {
    if (prefs?.rate && status.current === "idle") {
      speed.current = prefs.rate;
      patch({ speed: prefs.rate });
    }
  }, [prefs?.rate, patch]);

  const voice = () => (provider.current ??= createVoice({ muted: muted.current }));
  const alive = (g: number) => g === gen.current;

  const setStatus = useCallback(
    (next: State["status"]) => {
      status.current = next;
      patch({ status: next });
    },
    [patch]
  );

  const waitUnpaused = () =>
    paused.current ? new Promise<void>((r) => resumeWaiters.current.push(r)) : Promise.resolve();

  const nextInput = () =>
    new Promise<Input>((resolve) => {
      const queued = inputs.current.shift();
      if (queued !== undefined) return resolve(queued);
      inputWaiter.current = resolve;
    });

  const pushInput = (input: Input) => {
    const waiter = inputWaiter.current;
    if (waiter) {
      inputWaiter.current = null;
      waiter(input);
    } else inputs.current.push(input);
  };

  /** Speaks one line, surviving provider switches (mute, speed, blocked audio) mid-line. */
  const speakLine = async (g: number, text: string, highlights: string[], sceneLine: boolean) => {
    spoken.current = 0;
    patch({ caption: text, captionHighlights: highlights, spokenChars: 0, ...(sceneLine ? { sceneChars: 0 } : {}) });
    const reach = (chars: number) => {
      if (chars <= spoken.current) return;
      spoken.current = chars;
      patch(sceneLine ? { spokenChars: chars, sceneChars: chars } : { spokenChars: chars });
    };
    if (text.trim() && !skipScene.current) {
      rec.current.cancel();
      setStatus("speaking");
      let offset = 0;
      while (true) {
        await waitUnpaused();
        if (!alive(g) || skipScene.current || lineAbort.current) break;
        const p = voice();
        const base = offset;
        const off = p.onBoundary((i) => reach(base + i));
        speaking.current = true;
        try {
          await p.speak(text.slice(offset), { rate: speed.current, voiceURI: opts.current.prefs?.voiceURI });
        } catch {
          off();
          speaking.current = false;
          if (!alive(g)) return;
          provider.current = new CaptionProvider();
          patch({ audioBlocked: true });
          offset = spoken.current;
          continue;
        }
        off();
        speaking.current = false;
        if (switching.current) {
          switching.current = false;
          offset = spoken.current;
          continue;
        }
        break;
      }
    }
    speaking.current = false;
    lineAbort.current = false;
    if (alive(g)) reach(text.length);
  };

  const applyInteraction = async (
    g: number,
    scene: Scene,
    index: number,
    replay: BriefingAnswers | null
  ) => {
    const interaction = scene.interaction!;
    const queue = replay
      ? [...(answersToIntents(scene, replay) ?? recorded.current[scene.id] ?? [])]
      : null;
    const log: ReplayStep[] = [];
    let attempts = 0;
    let edits = 0;
    let limitReached = false;
    patch({ interaction, attempts: 0, clickOnly: false, editCount: 0, editLimitReached: false });

    while (alive(g)) {
      let intent: Intent;
      let via: Via = "click";
      let skipped = false;
      let optionId: string | undefined;

      if (skipScene.current) {
        intent = safeDefaultIntent(interaction);
        skipped = true;
      } else if (queue) {
        setStatus("waiting");
        await sleep(replayDelayMs);
        await waitUnpaused();
        if (!alive(g)) return;
        if (skipScene.current) continue;
        const step = queue.shift() ?? { intent: safeDefaultIntent(interaction), via: "click" as Via };
        intent = step.intent;
        via = step.via;
      } else {
        setStatus("waiting");
        const input = await nextInput();
        if (!alive(g)) return;
        if (input === SKIP) continue;
        if (input.kind === "click") {
          optionId = input.optionId;
          intent = intentFromOption(interaction, optionId);
        } else {
          via = input.kind;
          setStatus("thinking");
          intent = await parseIntent(input.transcript, interaction, { endpoint: opts.current.intentEndpoint });
          if (!alive(g)) return;
          if (skipScene.current) continue;
          if (intent.intent === "edit" && limitReached) {
            await speakLine(g, EDIT_LIMIT_LINE, [], false);
            setStatus("waiting");
            continue;
          }
          if (intent.intent === "unknown") {
            attempts += 1;
            const clickOnly = attempts >= 2;
            patch({ attempts, clickOnly });
            if (!clickOnly) {
              await speakLine(g, SORRY_LINE, [], false);
              if (via === "voice" && alive(g) && !skipScene.current) {
                setStatus("waiting");
                listenRef.current();
              }
            } else setStatus("waiting");
            continue;
          }
        }
      }

      log.push({ intent, via });
      setStatus("thinking");
      patch({ statusLine: { agent: scene.agent, text: `${scene.agent} is working on it…` } });
      let result: InteractionResult = {};
      try {
        result =
          (await opts.current.handlers.onInteraction(scene, intent, via, {
            via,
            replay: !!queue,
            skipped,
            optionId,
            editCount: edits,
            index,
          })) ?? {};
      } catch {
        result = {};
      }
      if (!alive(g)) return;
      patch({ statusLine: null });
      if (result.replaceNext) overrides.current[index + 1] = { ...overrides.current[index + 1], ...result.replaceNext };
      const isEdit = interaction.type === "edit" && intent.intent === "edit";
      if (isEdit) {
        edits += 1;
        patch({ editCount: edits });
      }
      if (result.speech && !skipAll.current) await speakLine(g, result.speech, result.highlights ?? [], false);
      if (!alive(g)) return;
      const stay = !skipped && (result.next ?? (isEdit ? "stay" : "advance")) === "stay";
      if (!stay) break;
      attempts = 0;
      patch({ attempts: 0, clickOnly: false });
      if (interaction.type === "edit" && edits >= maxEdits && !limitReached) {
        limitReached = true;
        patch({ editLimitReached: true });
        if (!queue) await speakLine(g, EDIT_LIMIT_LINE, [], false);
      }
    }
    if (!queue) recorded.current[scene.id] = log;
    patch({ interaction: null });
  };

  const run = async (from: number, replay: BriefingAnswers | null) => {
    const g = ++gen.current;
    const scenes = opts.current.script?.scenes ?? [];
    for (let i = from; i < scenes.length; i++) {
      await waitUnpaused();
      if (!alive(g)) return;
      const scene: Scene = { ...scenes[i], ...overrides.current[i] };
      currentScene.current = scene;
      skipScene.current = skipAll.current;
      inputs.current = [];
      patch({ current: scene, index: i, statusLine: null, interaction: null });
      opts.current.handlers.onSceneStart?.(scene, i);
      await speakLine(g, scene.speech, scene.captionHighlights ?? [], true);
      if (!alive(g)) return;
      if (scene.interaction) await applyInteraction(g, scene, i, replay);
      if (!alive(g)) return;
      opts.current.handlers.onSceneEnd?.(scene, i);
    }
    if (!alive(g)) return;
    currentScene.current = null;
    replaying.current = false;
    paused.current = false;
    patch({ paused: false, replaying: false, interaction: null });
    setStatus("done");
    opts.current.handlers.onFinish?.();
  };

  const stopEverything = () => {
    gen.current += 1;
    provider.current?.cancel();
    speaking.current = false;
    switching.current = false;
    lineAbort.current = false;
    rec.current.cancel();
    const waiter = inputWaiter.current;
    inputWaiter.current = null;
    waiter?.(SKIP);
    const waiters = resumeWaiters.current.splice(0);
    paused.current = false;
    waiters.forEach((r) => r());
  };

  const begin = useCallback(
    (from: number, replay: BriefingAnswers | null) => {
      if (!opts.current.script?.scenes.length) return;
      stopEverything();
      provider.current = createVoice({ muted: muted.current });
      provider.current.unlock?.();
      provider.current.resume();
      skipAll.current = false;
      skipScene.current = false;
      overrides.current = {};
      inputs.current = [];
      replaying.current = !!replay;
      patch({ audioBlocked: false, replaying: !!replay, paused: false, editLimitReached: false, statusLine: null });
      void run(from, replay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Call from a user gesture (the Start button) so audio unlocks. */
  const start = useCallback(() => {
    if (status.current !== "idle" && status.current !== "done") return;
    begin(opts.current.startIndex ?? 0, null);
  }, [begin]);

  /** Re-speaks the script from the top, auto-applying saved answers (no model calls). */
  const replay = useCallback(
    (answers?: BriefingAnswers) => begin(0, answers ?? opts.current.replay ?? {}),
    [begin]
  );

  const pause = useCallback(() => {
    if (paused.current || status.current === "idle" || status.current === "done") return;
    paused.current = true;
    provider.current?.pause();
    rec.current.cancel();
    patch({ paused: true });
  }, [patch]);

  const resume = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    provider.current?.resume();
    patch({ paused: false });
    resumeWaiters.current.splice(0).forEach((r) => r());
  }, [patch]);

  const togglePause = useCallback(() => (paused.current ? resume() : pause()), [pause, resume]);

  /** Swaps the provider; a line being spoken continues from the current word. */
  const swapProvider = (next: VoiceProvider) => {
    const old = provider.current;
    provider.current = next;
    if (paused.current) next.pause();
    if (speaking.current && old) {
      switching.current = true;
      old.cancel();
    }
  };

  const toggleMute = useCallback(() => {
    muted.current = !muted.current;
    const next = createVoice({ muted: muted.current });
    if (!muted.current) next.unlock?.();
    swapProvider(next);
    patch({ muted: muted.current, audioBlocked: false });
     
  }, [patch]);

  /** "Tap to hear Nudge": retry audio from a gesture after the browser blocked it. */
  const unlockAudio = useCallback(() => {
    muted.current = false;
    const next = createVoice({ muted: false });
    next.unlock?.();
    swapProvider(next);
    patch({ muted: false, audioBlocked: false });
     
  }, [patch]);

  const setSpeed = useCallback(
    (rate: VoiceRate) => {
      speed.current = rate;
      patch({ speed: rate });
      if (speaking.current && provider.current) {
        switching.current = true;
        provider.current.cancel();
      }
    },
    [patch]
  );

  /** Ends the current scene now; an open interaction gets its safe default (confirm → decline). */
  const skip = useCallback(() => {
    if (status.current === "idle" || status.current === "done") return;
    skipScene.current = true;
    rec.current.cancel();
    if (speaking.current) provider.current?.cancel();
    pushInput(SKIP);
    if (paused.current) resume();
     
  }, [resume]);

  /** Applies safe defaults through to the end (handlers still run), then onFinish. */
  const skipToEnd = useCallback(() => {
    if (status.current === "idle" || status.current === "done") return;
    skipAll.current = true;
    skip();
  }, [skip]);

  /** Answer the open interaction. Interrupts Nudge if it is still talking. */
  const respond = useCallback((input: RespondInput) => {
    if (!currentScene.current?.interaction || replaying.current) return;
    if (status.current === "thinking" || status.current === "idle" || status.current === "done") return;
    if (input.kind !== "click" && !input.transcript.trim()) return;
    if (speaking.current) {
      lineAbort.current = true;
      provider.current?.cancel();
    }
    if (paused.current) resume();
    pushInput(input);
     
  }, [resume]);

  /** Opens the mic for the current interaction (stops TTS first). */
  const listen = useCallback(async () => {
    const r = rec.current;
    if (!r.supported || r.listening || !currentScene.current?.interaction || replaying.current) return;
    if (status.current !== "waiting" && status.current !== "speaking") return;
    if (speaking.current) {
      lineAbort.current = true;
      provider.current?.cancel();
    }
    const transcript = await r.start();
    if (transcript) respond({ kind: "voice", transcript });
  }, [respond]);

  useEffect(() => {
    listenRef.current = () => void listen();
  }, [listen]);

  const setStatusLine = useCallback((agent: AgentName, text: string) => patch({ statusLine: { agent, text } }), [patch]);
  const clearStatusLine = useCallback(() => patch({ statusLine: null }), [patch]);

  useEffect(
    () => () => {
      gen.current += 1;
      provider.current?.cancel();
    },
    []
  );

  const { caption, sceneChars, current } = state;
  const isSpoken = useCallback(
    (needle: string) => {
      if (!current) return state.status === "done";
      const speech = current.speech;
      if (sceneChars >= speech.length) return true;
      const at = speech.toLowerCase().indexOf(needle.toLowerCase());
      return at >= 0 ? sceneChars >= at : false;
    },
    [current, sceneChars, state.status]
  );

  const exposedStatus: EngineStatus = state.paused
    ? "paused"
    : recognition.listening
      ? "listening"
      : state.status;
  const interaction = state.interaction;
  const buttons: InteractionOption[] = useMemo(() => (interaction ? interactionOptions(interaction) : []), [interaction]);

  return {
    status: exposedStatus,
    current,
    index: state.index,
    total: script?.scenes.length ?? 0,
    caption,
    captionHighlights: state.captionHighlights,
    spokenChars: state.spokenChars,
    sceneChars,
    interaction,
    options: buttons,
    defaultOptionId: interaction ? defaultOptionId(interaction) : undefined,
    muted: state.muted,
    speed: state.speed,
    audioBlocked: state.audioBlocked,
    listening: recognition.listening,
    interim: recognition.interim,
    micSupported: recognition.supported,
    micError: recognition.error,
    attempts: state.attempts,
    clickOnly: state.clickOnly,
    editCount: state.editCount,
    editLimitReached: state.editLimitReached,
    replaying: state.replaying,
    statusLine: state.statusLine,
    thinking: state.status === "thinking",
    isSpoken,
    start,
    pause,
    resume,
    togglePause,
    toggleMute,
    unlockAudio,
    skipScene: skip,
    skipAll: skipToEnd,
    setSpeed,
    replay,
    respond,
    listen,
    stopListening: recognition.stop,
    setStatusLine,
    clearStatusLine,
  };
}

export type SceneEngine = ReturnType<typeof useSceneEngine>;
