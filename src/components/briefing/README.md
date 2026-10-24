# Briefing engine

Plays a `SceneScript` (`src/nudge/scenes.ts`): speaks each scene, opens its interaction, waits for an
answer, hands the parsed intent to your handler, moves on. Harness: `/dev/briefing-engine`
(`?auto=1` runs muted with canned replies).

## Voice (`src/nudge/voice`)

- `VoiceProvider`: `speak(text, { rate, voiceURI }) → Promise<void>` (resolves on end or `cancel()`,
  rejects with `VoiceError("blocked" | "failed")`), `cancel`, `pause`, `resume`,
  `onBoundary(cb(charIndex)) → off`, `onEnd(cb) → off`, `available`, optional `unlock()`.
- `WebSpeechProvider` (sentence-by-sentence, estimated boundaries for voices that send none),
  `CaptionProvider` (silent, ~180 wpm × rate), `createVoice({ muted })`, `listVoices()` for Settings.
- `useSpeechRecognition()` → `{ supported, listening, interim, error, start(): Promise<string | null>, stop(), cancel() }`.
- `prefs.ts`: `useVoicePrefs() → { prefs: { voiceURI?, rate: 0.9 | 1 | 1.15, mutedByDefault, briefing: "always" | "daily" | "off" }, update(patch) }`,
  `shouldAutoBrief(lastBriefedISO?, mode?)`, `markBriefed()`, `lastBriefed()`.

## `useSceneEngine(options)`

```ts
const engine = useSceneEngine({
  script,                      // SceneScript | null
  startIndex,                  // optional
  prefs,                       // { voiceURI, rate, mutedByDefault } from useVoicePrefs()
  replay: savedAnswers,        // BriefingAnswers used by engine.replay()
  handlers: {
    onInteraction: async (scene, intent, via, ctx) => ({ speech, highlights, next, replaceNext }),
    onSceneStart, onSceneEnd, onFinish,
  },
});
```

`onInteraction(scene, intent, via, ctx)`: `intent` is already normalised for the interaction
(`confirm|decline`, `choose` with a valid `choiceId`, `edit` with `editInstruction`, or `done`).
`ctx = { via, replay, skipped, optionId, editCount, index }`.

- Return `speech` to have Nudge say a follow-up line (plan sentence, "Done, I removed…").
- `replaceNext: Partial<Scene>` is merged into the next scene before it plays (the plan line after the pick).
- `next: "stay"` keeps the interaction open (default for `edit` intents); anything else advances. After
  3 edits `editLimitReached` turns on, Nudge says so once, and further edit intents are refused.
- `ctx.replay`: do not call the model; use `answers.planSpeech` etc. `ctx.skipped`: safe default from Skip.
- `optionId === "editor"`: the user pressed **Open editor**; return `next: "stay"` and call
  `engine.respond({ kind: "click", optionId: "done" })` when the editor closes.
- While the handler runs, status is `thinking` and `statusLine` is `"<agent> is working on it…"`;
  call `engine.setStatusLine("Planner", "Planner is working out your day…")` to override it.

Interactions also resolve from `engine.respond(input)`: `{ kind: "click", optionId }` or
`{ kind: "text" | "voice", transcript }` (parsed by `POST /api/briefing/intent`, with a local
fallback). Responding while Nudge is still talking interrupts it. On `unknown` Nudge says
"Sorry, I didn't catch that." once (re-listening after a voice answer); a second miss sets
`clickOnly`. Skipping never approves: confirm → decline, choice → first option, edit → done.

### State

`status` (`idle | speaking | waiting | listening | thinking | paused | done`), `current`, `index`,
`total`, `caption`, `captionHighlights`, `spokenChars` (current line), `sceneChars` (the scene's own
line), `interaction`, `options`, `defaultOptionId`, `muted`, `speed`, `audioBlocked`, `listening`,
`interim`, `micSupported`, `micError`, `attempts`, `clickOnly`, `editCount`, `editLimitReached`,
`replaying`, `statusLine`, `thinking`, `isSpoken(text)`.

`isSpoken("invoices export")` is true once the scene's speech reaches that substring (or the line
is done); use it to stagger reveals "as each is named".

### Actions

`start()` (call from the Start button so audio unlocks), `pause`, `resume`, `togglePause`,
`toggleMute` (switches provider mid-line), `unlockAudio` (for the "Tap to hear Nudge" hint shown
when `audioBlocked`), `skipScene`, `skipAll`, `setSpeed(0.9 | 1 | 1.15)`, `replay(answers?)`,
`respond(input)`, `listen()`, `stopListening`, `setStatusLine(agent, text)`, `clearStatusLine`.

## Components

- `<Caption text highlights spokenChars />`
- `<ControlBar engine floating? keyboard? />`: Space pause, Esc skip all, Enter default button
  (`useBriefingKeys(engine)` if you render your own bar).
- `<InteractionPanel engine interaction? hints? />`: buttons, "or type…", mic, hint chips.
- `<OwlAvatar state urgent? size />` with `owlStateFor(engine.status)`.
- `<StatusLine agent text />`
