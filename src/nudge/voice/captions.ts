import { Emitter, wordSpans, type SpeakOptions, type VoiceProvider } from "./types";

const BASE_WPM = 180;

/** Per-word dwell time in ms, with short pauses after commas and sentence ends. */
export function wordDuration(word: string, rate = 1, wpm = BASE_WPM) {
  const base = 60000 / (wpm * rate);
  if (/[.!?]["')\]]*$/.test(word)) return base + 280 / rate;
  if (/[,;:]$/.test(word)) return base + 140 / rate;
  return base;
}

/** Estimated reading time of a line at the given rate. */
export function readingTime(text: string, rate = 1, wpm = BASE_WPM) {
  return wordSpans(text).reduce((ms, w) => ms + wordDuration(w.word, rate, wpm), 0);
}

/**
 * Silent provider: "speaks" by walking the words on a timer (~180 wpm, scaled by rate)
 * and firing a boundary for each, so captions and staggered reveals behave as with audio.
 */
export class CaptionProvider implements VoiceProvider {
  readonly kind = "captions" as const;
  readonly available = true;
  private boundary = new Emitter<[number]>();
  private ended = new Emitter<[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run: {
    spans: ReturnType<typeof wordSpans>;
    i: number;
    rate: number;
    due: number;
    remaining: number;
    resolve: () => void;
  } | null = null;
  private paused = false;

  constructor(private wpm = BASE_WPM) {}

  speak(text: string, opts: SpeakOptions = {}) {
    this.cancel();
    return new Promise<void>((resolve) => {
      this.run = { spans: wordSpans(text), i: 0, rate: opts.rate ?? 1, due: 0, remaining: 0, resolve };
      if (!this.paused) this.step();
    });
  }

  private step() {
    const run = this.run;
    if (!run) return;
    if (run.i >= run.spans.length) {
      this.run = null;
      run.resolve();
      this.ended.emit();
      return;
    }
    const span = run.spans[run.i++];
    this.boundary.emit(span.start);
    this.schedule(wordDuration(span.word, run.rate, this.wpm));
  }

  private schedule(ms: number) {
    if (!this.run) return;
    this.run.due = Date.now() + ms;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.step();
    }, ms);
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const run = this.run;
    this.run = null;
    run?.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    if (this.timer && this.run) {
      clearTimeout(this.timer);
      this.timer = null;
      this.run.remaining = Math.max(0, this.run.due - Date.now());
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    const run = this.run;
    if (!run || this.timer) return;
    if (run.i === 0) this.step();
    else this.schedule(run.remaining);
  }

  onBoundary(cb: (charIndex: number) => void) {
    return this.boundary.on(cb);
  }

  onEnd(cb: () => void) {
    return this.ended.on(cb);
  }
}
