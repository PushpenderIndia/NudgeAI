import { wordDuration } from "./captions";
import { Emitter, VoiceError, speechChunks, wordSpans, type SpeakOptions, type VoiceProvider } from "./types";

const QUALITY = /natural|neural|premium|enhanced/i;
const KNOWN_GOOD = /google|samantha|daniel|karen|moira|serena|tessa|aria|jenny|guy|libby|sonia|ava|allison|evan/i;
const NOVELTY =
  /compact|eloquence|albert|bad news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|rocko|shelley|flo\b|eddy|reed|sandy|fred|junior|ralph|kathy/i;

function synth() {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

export function speechSupported() {
  return synth() !== null && typeof window.SpeechSynthesisUtterance === "function";
}

export function voiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService" | "default">) {
  if (!/^en/i.test(v.lang)) return -Infinity;
  let score = /^en[-_]US/i.test(v.lang) ? 3 : /^en[-_](GB|AU|IE|CA|IN)/i.test(v.lang) ? 2 : 1;
  if (v.localService) score += 4;
  if (QUALITY.test(v.name)) score += 6;
  if (KNOWN_GOOD.test(v.name)) score += 3;
  if (NOVELTY.test(v.name)) score -= 10;
  if (v.default) score += 1;
  return score;
}

export function pickVoice(voices: SpeechSynthesisVoice[], voiceURI?: string) {
  const chosen = voiceURI ? voices.find((v) => v.voiceURI === voiceURI) : undefined;
  if (chosen) return chosen;
  let best: SpeechSynthesisVoice | null = null;
  for (const v of voices) if (voiceScore(v) > (best ? voiceScore(best) : -Infinity)) best = v;
  return best;
}

/** Voices load asynchronously in Chrome; waits for voiceschanged (up to 1.5 s). */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return Promise.resolve([]);
  const now = s.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      s.removeEventListener("voiceschanged", done);
      resolve(s.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    s.addEventListener("voiceschanged", done);
  });
}

type Run = {
  chunks: { start: number; text: string }[];
  ci: number;
  /** Char offset inside the current chunk where speaking (re)starts. */
  from: number;
  /** Start of the last word reached inside the current chunk. */
  pos: number;
  started: boolean;
  rate: number;
  voice: SpeechSynthesisVoice | null;
  resolve: () => void;
  reject: (error: VoiceError) => void;
};

/**
 * speechSynthesis provider. Speaks sentence by sentence (avoids Chrome's ~15 s cutoff),
 * estimates word boundaries for voices that do not report them, implements pause as
 * cancel-and-resume-from-last-word (Chrome's native pause is unreliable), and rejects
 * with VoiceError("blocked") when the browser refuses to start audio.
 */
export class WebSpeechProvider implements VoiceProvider {
  readonly kind = "speech" as const;
  private boundary = new Emitter<[number]>();
  private ended = new Emitter<[]>();
  private run: Run | null = null;
  private current: SpeechSynthesisUtterance | null = null;
  private paused = false;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private estimateTimer: ReturnType<typeof setTimeout> | null = null;
  private kick: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor(private blockedAfterMs = 3000) {}

  get available() {
    return speechSupported();
  }

  unlock() {
    const s = synth();
    if (!s || s.speaking || s.pending) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    s.speak(u);
  }

  async speak(text: string, opts: SpeakOptions = {}) {
    this.cancel();
    const token = this.seq;
    const s = synth();
    if (!s) throw new VoiceError("failed", "Speech synthesis is not available.");
    let voices = s.getVoices();
    if (!voices.length) voices = await loadVoices();
    if (token !== this.seq) return;
    return new Promise<void>((resolve, reject) => {
      this.run = {
        chunks: speechChunks(text),
        ci: 0,
        from: 0,
        pos: 0,
        started: false,
        rate: opts.rate ?? 1,
        voice: pickVoice(voices, opts.voiceURI),
        resolve,
        reject,
      };
      if (!this.paused) this.later();
    });
  }

  /** Chrome sometimes drops a speak() issued right after cancel(); start on the next tick. */
  private later() {
    if (this.kick) clearTimeout(this.kick);
    this.kick = setTimeout(() => {
      this.kick = null;
      this.speakChunk();
    }, 40);
  }

  private speakChunk() {
    const s = synth();
    const run = this.run;
    if (!s || !run || this.paused) return;
    if (run.ci >= run.chunks.length) return this.finish();
    const chunk = run.chunks[run.ci];
    const text = chunk.text.slice(run.from);
    const base = chunk.start + run.from;
    if (!text.trim()) return this.nextChunk();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = run.voice?.lang ?? "en-US";
    if (run.voice) u.voice = run.voice;
    u.rate = run.rate;
    let realBoundaries = false;
    u.onstart = () => {
      if (this.current !== u) return;
      this.clearStart();
      run.started = true;
      this.mark(run, run.from, base);
      this.estimate(u, text, run, () => realBoundaries);
    };
    u.onboundary = (event) => {
      if (this.current !== u || (event.name && event.name !== "word")) return;
      realBoundaries = true;
      this.mark(run, run.from + event.charIndex, chunk.start + run.from + event.charIndex);
    };
    u.onend = () => {
      if (this.current !== u) return;
      this.nextChunk();
    };
    u.onerror = (event) => {
      if (this.current !== u) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      this.fail(new VoiceError(event.error === "not-allowed" ? "blocked" : "failed"));
    };
    this.current = u;
    if (s.paused) s.resume();
    s.speak(u);
    if (!run.started) {
      this.clearStart();
      this.startTimer = setTimeout(() => this.current === u && !run.started && this.fail(new VoiceError("blocked")), this.blockedAfterMs);
    }
  }

  private mark(run: Run, posInChunk: number, absolute: number) {
    run.pos = posInChunk;
    this.boundary.emit(absolute);
  }

  /** Word timer for voices (e.g. Chrome's network voices) that never fire boundary events. */
  private estimate(u: SpeechSynthesisUtterance, text: string, run: Run, real: () => boolean) {
    const spans = wordSpans(text);
    const chunkStart = run.chunks[run.ci].start;
    const from = run.from;
    let i = 0;
    const tick = () => {
      if (this.current !== u || real() || i >= spans.length) return;
      const span = spans[i++];
      if (i > 1) this.mark(run, from + span.start, chunkStart + from + span.start);
      this.estimateTimer = setTimeout(tick, wordDuration(span.word, run.rate, 170));
    };
    tick();
  }

  private nextChunk() {
    const run = this.run;
    if (!run) return;
    this.stopTimers();
    run.ci += 1;
    run.from = 0;
    run.pos = 0;
    this.current = null;
    this.speakChunk();
  }

  private finish() {
    const run = this.run;
    this.run = null;
    this.current = null;
    this.stopTimers();
    run?.resolve();
    this.ended.emit();
  }

  private fail(error: VoiceError) {
    const run = this.run;
    this.run = null;
    this.current = null;
    this.stopTimers();
    synth()?.cancel();
    run?.reject(error);
  }

  private clearStart() {
    if (this.startTimer) clearTimeout(this.startTimer);
    this.startTimer = null;
  }

  private stopTimers() {
    this.clearStart();
    if (this.estimateTimer) clearTimeout(this.estimateTimer);
    if (this.kick) clearTimeout(this.kick);
    this.estimateTimer = null;
    this.kick = null;
  }

  cancel() {
    this.seq += 1;
    const run = this.run;
    this.run = null;
    this.current = null;
    this.stopTimers();
    synth()?.cancel();
    run?.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    const run = this.run;
    this.current = null;
    this.stopTimers();
    synth()?.cancel();
    if (run) run.from = run.pos;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.run && !this.current) this.later();
  }

  onBoundary(cb: (charIndex: number) => void) {
    return this.boundary.on(cb);
  }

  onEnd(cb: () => void) {
    return this.ended.on(cb);
  }
}
