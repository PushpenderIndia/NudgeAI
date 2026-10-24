/**
 * A swappable speech output. Web Speech is the default; CaptionProvider is the silent
 * fallback. A hosted TTS or LiveKit provider only has to implement this interface.
 */
export type SpeakOptions = { rate?: number; voiceURI?: string };

export interface VoiceProvider {
  readonly kind: "speech" | "captions";
  /** False when the backend cannot speak in this browser. */
  readonly available: boolean;
  /**
   * Resolves when the text has been spoken or cancel() was called.
   * Rejects with a VoiceError when audio is blocked or the backend fails.
   */
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  cancel(): void;
  pause(): void;
  resume(): void;
  /** Character index (into the text passed to speak) of the word now being spoken. */
  onBoundary(cb: (charIndex: number) => void): () => void;
  /** Fires when a speak() call finishes naturally (not on cancel). */
  onEnd(cb: () => void): () => void;
  /** Call synchronously inside a user gesture to unlock audio (iOS/Safari). */
  unlock?(): void;
}

export class VoiceError extends Error {
  constructor(
    readonly code: "blocked" | "failed",
    message = code === "blocked" ? "Audio is blocked until the page is tapped." : "Speech failed."
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

export function isVoiceError(error: unknown): error is VoiceError {
  return error instanceof VoiceError;
}

/** Tiny listener set shared by the providers. */
export class Emitter<T extends unknown[]> {
  private listeners = new Set<(...args: T) => void>();
  on(cb: (...args: T) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  emit(...args: T) {
    for (const cb of this.listeners) cb(...args);
  }
}

/** Splits text into [start, end) word spans, keeping trailing punctuation with the word. */
export function wordSpans(text: string) {
  const spans: { start: number; end: number; word: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length, word: m[0] });
  return spans;
}

/**
 * Splits text into sentence-sized chunks (Chrome stops utterances after ~15 s),
 * breaking long sentences at commas. Offsets point into the original text.
 */
export function speechChunks(text: string, max = 180) {
  const chunks: { start: number; text: string }[] = [];
  const re = /[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m[0]) {
    let start = m.index;
    let rest = m[0];
    while (rest.length > max) {
      const cut = rest.lastIndexOf(", ", max);
      const at = cut > 40 ? cut + 2 : rest.lastIndexOf(" ", max) + 1 || max;
      chunks.push({ start, text: rest.slice(0, at) });
      start += at;
      rest = rest.slice(at);
    }
    if (rest.trim()) chunks.push({ start, text: rest });
  }
  return chunks;
}
