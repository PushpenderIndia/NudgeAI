"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/**
 * One-shot speech recognition (en-US, interim results). start() resolves with the final
 * transcript, or null on silence, error, permission denial or cancel(). Callers must stop
 * TTS first so the owl never hears itself (the scene engine does this).
 */
export function useSpeechRecognition({ timeoutMs = 9000 }: { timeoutMs?: number } = {}) {
  const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{ rec: Recognition; aborted: boolean } | null>(null);

  const start = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        active.current?.rec.abort();
        const Ctor = recognitionCtor();
        if (!Ctor) return resolve(null);
        const rec = new Ctor();
        const session = { rec, aborted: false };
        rec.lang = "en-US";
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        let finalText = "";
        let latest = "";
        let settled = false;
        const timer = setTimeout(() => rec.stop(), timeoutMs);
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (active.current === session) {
            active.current = null;
            setListening(false);
            setInterim("");
          }
          resolve(session.aborted ? null : (finalText || latest).trim() || null);
        };
        rec.onresult = (event) => {
          let pending = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) finalText += result[0].transcript;
            else pending += result[0].transcript;
          }
          latest = `${finalText}${pending}`.trim();
          setInterim(latest);
        };
        rec.onerror = (event) => {
          if (event.error !== "no-speech" && event.error !== "aborted") setError(event.error);
        };
        rec.onend = finish;
        active.current = session;
        setError(null);
        setInterim("");
        setListening(true);
        try {
          rec.start();
        } catch {
          setError("start-failed");
          finish();
        }
      }),
    [timeoutMs]
  );

  /** Stops listening and resolves start() with whatever was heard. */
  const stop = useCallback(() => active.current?.rec.stop(), []);

  /** Stops listening and resolves start() with null. */
  const cancel = useCallback(() => {
    const session = active.current;
    if (!session) return;
    session.aborted = true;
    session.rec.abort();
  }, []);

  useEffect(
    () => () => {
      const session = active.current;
      if (session) {
        session.aborted = true;
        session.rec.abort();
      }
    },
    []
  );

  return { supported, listening, interim, error, start, stop, cancel };
}
