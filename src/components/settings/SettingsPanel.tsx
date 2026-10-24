"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ResetDemoButton } from "@/components/demo/ResetDemoButton";
import type { ConnectionKey, ConnectionStatus } from "@/lib/connections";
import { exitDemo, startDemo } from "@/lib/demo-client";
import { cn } from "@/lib/utils";
import { WebSpeechProvider, listVoices, speechSupported, type VoiceOption } from "@/nudge/voice";
import { VOICE_RATES, useVoicePrefs, type BriefingMode, type VoiceRate } from "@/nudge/voice/prefs";

const SAMPLE_LINE = "Good morning. I checked your PRs, tickets and calendar. Here is what matters first.";

const BRIEFING_OPTIONS: { key: BriefingMode; label: string }[] = [
  { key: "always", label: "Always" },
  { key: "daily", label: "Once a day" },
  { key: "off", label: "Off" },
];

const BRIEFING_HINT: Record<BriefingMode, string> = {
  always: "I speak the briefing every time you open Today.",
  daily: "I speak the briefing on your first visit each day. Replay it any time.",
  off: "I never start speaking on my own. Press Start my day when you want me.",
};

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-2/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.key ? "bg-primary text-white" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3 divide-y divide-border border-y border-border">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function VoiceSettings() {
  const { prefs, update } = useVoicePrefs();
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = useRef<WebSpeechProvider | null>(null);

  useEffect(() => {
    let live = true;
    listVoices()
      .then((list) => live && setVoices(list))
      .catch(() => live && setVoices([]));
    return () => {
      live = false;
      voice.current?.cancel();
    };
  }, []);

  async function test() {
    if (speaking) {
      voice.current?.cancel();
      setSpeaking(false);
      return;
    }
    setError(null);
    const v = (voice.current ??= new WebSpeechProvider());
    v.unlock();
    setSpeaking(true);
    try {
      await v.speak(SAMPLE_LINE, { rate: prefs.rate, voiceURI: prefs.voiceURI });
    } catch {
      setError("Your browser would not play speech. Captions still work.");
    } finally {
      setSpeaking(false);
    }
  }

  const supported = voices !== null && speechSupported();
  const selected = voices?.some((v) => v.voiceURI === prefs.voiceURI) ? prefs.voiceURI : "";

  return (
    <Section title="Voice" description="How I sound when I brief you. Saved in this browser.">
      <Field
        label="Voice"
        hint={voices === null ? "Loading voices…" : !supported || voices.length === 0 ? "This browser has no English speech voices. I'll show captions instead." : "Recommended local English voices come first."}
      >
        <select
          value={selected}
          disabled={!voices?.length}
          onChange={(e) => update({ voiceURI: e.target.value || undefined })}
          className="h-9 w-full max-w-xs rounded-lg border border-border bg-surface px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft sm:w-72"
        >
          <option value="">Automatic (best available)</option>
          {voices?.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
              {v.recommended ? " · recommended" : v.local ? "" : " · online"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Speed">
        <Segmented<VoiceRate>
          label="Speed"
          value={prefs.rate}
          options={VOICE_RATES.map((r) => ({ key: r, label: `${r}×` }))}
          onChange={(rate) => update({ rate })}
        />
      </Field>
      <Field label="Mute by default" hint="Start with captions only. You can unmute during the briefing.">
        <Switch checked={prefs.mutedByDefault} onCheckedChange={(mutedByDefault) => update({ mutedByDefault })} aria-label="Mute by default" />
      </Field>
      <Field label="Test voice" hint={error ?? `“${SAMPLE_LINE}”`}>
        <Button variant="outline" size="sm" onClick={test} disabled={voices !== null && !supported}>
          {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {speaking ? "Stop" : "Test voice"}
        </Button>
      </Field>
    </Section>
  );
}

function BriefingSettings() {
  const { prefs, update } = useVoicePrefs();
  return (
    <Section title="Voice briefing">
      <Field label="Speak the briefing" hint={BRIEFING_HINT[prefs.briefing]}>
        <Segmented label="Voice briefing" value={prefs.briefing} options={BRIEFING_OPTIONS} onChange={(briefing) => update({ briefing })} />
      </Field>
    </Section>
  );
}

const CONNECTIONS: { key: ConnectionKey; label: string; env: string }[] = [
  { key: "github", label: "GitHub", env: "GITHUB_TOKEN" },
  { key: "jira", label: "Jira", env: "JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN" },
  { key: "calendar", label: "Google Calendar", env: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" },
  { key: "slack", label: "Slack webhook", env: "SLACK_WEBHOOK_URL" },
];

function ConnectionsSettings({ demo, connections }: { demo: boolean; connections: ConnectionStatus }) {
  const router = useRouter();
  async function exit() {
    await exitDemo();
    router.replace("/");
  }
  return (
    <Section
      title="Connections"
      description={demo ? "This session runs on the demo story; nothing touches real services." : "Live integrations are configured on the server through environment variables."}
    >
      {demo ? (
        <Field label="Using demo data" hint="GitHub, Jira, calendar, inbox and Slack come from the sample developer, Aarav.">
          <Button variant="outline" size="sm" onClick={exit}>
            Exit demo
          </Button>
        </Field>
      ) : (
        CONNECTIONS.map((c) => {
          const on = connections[c.key];
          return (
            <Field key={c.key} label={c.label} hint={on ? "Configured on the server." : `Set ${c.env} to connect.`}>
              <span className={cn("inline-flex items-center gap-1.5 text-xs", on ? "text-fg" : "text-muted")}>
                <span className={cn("h-2 w-2 rounded-full", on ? "bg-success" : "bg-muted/40")} />
                {on ? "Connected" : "Not connected"}
              </span>
            </Field>
          );
        })
      )}
    </Section>
  );
}

function DemoSettings({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const key = await startDemo();
    setBusy(false);
    if (key) router.refresh();
  }
  return (
    <Section title="Demo">
      {demo ? (
        <Field label="Reset demo" hint="Restore the starting story: tickets, inbox, Slack and approvals.">
          <ResetDemoButton />
        </Field>
      ) : (
        <Field label="Try the demo" hint="Run Start my day on a sample developer's morning. No logins needed.">
          <Button variant="outline" size="sm" onClick={start} disabled={busy}>
            <Play className="h-3.5 w-3.5" />
            {busy ? "Starting…" : "Try the demo"}
          </Button>
        </Field>
      )}
    </Section>
  );
}

export function SettingsPanel({ demo, connections }: { demo: boolean; connections: ConnectionStatus }) {
  return (
    <div className="max-w-3xl space-y-8">
      <VoiceSettings />
      <BriefingSettings />
      <ConnectionsSettings demo={demo} connections={connections} />
      <DemoSettings demo={demo} />
    </div>
  );
}
