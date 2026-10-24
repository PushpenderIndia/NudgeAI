"use client";

import { useCallback, useSyncExternalStore } from "react";

export type VoiceRate = 0.9 | 1 | 1.15;
export const VOICE_RATES: VoiceRate[] = [0.9, 1, 1.15];
export type BriefingMode = "always" | "daily" | "off";

export type VoicePrefs = {
  voiceURI?: string;
  rate: VoiceRate;
  mutedByDefault: boolean;
  briefing: BriefingMode;
};

export const DEFAULT_VOICE_PREFS: VoicePrefs = { rate: 1, mutedByDefault: false, briefing: "daily" };

const PREFS_KEY = "nudge.voice.prefs";
const BRIEFED_KEY = "nudge.briefing.last";
const CHANGE_EVENT = "nudge:voice-prefs";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: preferences simply do not persist.
  }
}

function parse(raw: string | null): VoicePrefs {
  if (!raw) return DEFAULT_VOICE_PREFS;
  try {
    const data = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      voiceURI: typeof data.voiceURI === "string" && data.voiceURI ? data.voiceURI : undefined,
      rate: VOICE_RATES.includes(data.rate as VoiceRate) ? (data.rate as VoiceRate) : 1,
      mutedByDefault: data.mutedByDefault === true,
      briefing: data.briefing === "always" || data.briefing === "off" ? data.briefing : "daily",
    };
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

let cache: { raw: string | null; prefs: VoicePrefs } = { raw: null, prefs: DEFAULT_VOICE_PREFS };

export function readVoicePrefs(): VoicePrefs {
  if (typeof window === "undefined") return DEFAULT_VOICE_PREFS;
  const raw = read(PREFS_KEY);
  if (raw !== cache.raw) cache = { raw, prefs: parse(raw) };
  return cache.prefs;
}

export function writeVoicePrefs(patch: Partial<VoicePrefs>) {
  write(PREFS_KEY, JSON.stringify({ ...readVoicePrefs(), ...patch }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => event.key === PREFS_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Voice preferences from localStorage, shared live across components and tabs. */
export function useVoicePrefs() {
  const prefs = useSyncExternalStore(subscribe, readVoicePrefs, () => DEFAULT_VOICE_PREFS);
  const update = useCallback((patch: Partial<VoicePrefs>) => writeVoicePrefs(patch), []);
  return { prefs, update };
}

export function lastBriefed(): string | null {
  return typeof window === "undefined" ? null : read(BRIEFED_KEY);
}

export function markBriefed(at: Date = new Date()) {
  write(BRIEFED_KEY, at.toISOString());
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Whether the spoken briefing should start on its own: "always" every visit, "daily"
 * only on the first visit of the local day, "off" never. Defaults to the stored marker.
 */
export function shouldAutoBrief(
  lastBriefedISO: string | null | undefined = lastBriefed(),
  mode: BriefingMode = readVoicePrefs().briefing,
  now: Date = new Date()
) {
  if (mode === "off") return false;
  if (mode === "always" || !lastBriefedISO) return true;
  const last = new Date(lastBriefedISO);
  return Number.isNaN(last.getTime()) || !sameLocalDay(last, now);
}
