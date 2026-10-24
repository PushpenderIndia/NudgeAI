import { CaptionProvider } from "./captions";
import { WebSpeechProvider, loadVoices, speechSupported, voiceScore } from "./web-speech";
import type { VoiceProvider } from "./types";

export * from "./types";
export { CaptionProvider, readingTime, wordDuration } from "./captions";
export { WebSpeechProvider, loadVoices, pickVoice, speechSupported, voiceScore } from "./web-speech";

/** Web Speech when it can speak and is not muted; otherwise silent timed captions. */
export function createVoice({ muted = false }: { muted?: boolean } = {}): VoiceProvider {
  if (!muted && speechSupported()) return new WebSpeechProvider();
  return new CaptionProvider();
}

export type VoiceOption = { voiceURI: string; name: string; lang: string; local: boolean; recommended: boolean };

/** English voices for the Settings picker, best first. */
export async function listVoices(): Promise<VoiceOption[]> {
  const voices = (await loadVoices()).filter((v) => voiceScore(v) > -Infinity);
  voices.sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
  return voices.map((v, i) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    local: v.localService,
    recommended: i === 0,
  }));
}
