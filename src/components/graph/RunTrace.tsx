"use client";

import { Fragment } from "react";
import { formatDuration, isFinished, type RunView } from "@/lib/agent-runs";
import type { RunDetail } from "@/lib/runs";
import type { BriefingAnswers, Scene, SceneScript } from "@/nudge/scenes";
import { AgentIcon } from "@/components/today/AgentIcon";
import { StepTimeline } from "@/components/today/StepTimeline";
import type { Playback } from "@/components/today/hooks";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import { AgentGraph } from "./AgentGraph";
import { useLiveRun } from "./hooks";
import { RunStatusBadge, ScriptSourceBadge, TRIGGER_LABEL } from "./RunBadges";
import { HandoffChain } from "./HandoffChain";

/** Full trace for /runs/[id]: live graph, every step, and the saved scene script with answers. */
export function RunTrace({ initial }: { initial: RunDetail }) {
  const run = useLiveRun(initial.id, initial, true) ?? initial;
  const detail = run as Partial<RunDetail>;
  const script = detail.sceneScript ?? initial.sceneScript;
  const answers = detail.answers ?? initial.answers;
  const source = detail.scriptSource ?? initial.scriptSource;

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{run.title}</h1>
          <RunStatusBadge status={run.status} />
          <ScriptSourceBadge source={source} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {TRIGGER_LABEL[run.type] ?? run.type}
          {run.startedAt && ` · started ${formatTime(run.startedAt)} · ${formatDuration(run.startedAt, run.finishedAt)}`}
          {` · ${run.steps.length} ${run.steps.length === 1 ? "step" : "steps"}`}
        </p>
        {run.summary && <p className="mt-3 max-w-2xl text-sm text-fg/85">{run.summary}</p>}
        <HandoffChain run={run} className="mt-3" />
      </header>

      <section aria-label="Agent graph" className="rounded-2xl border border-border bg-surface/40">
        <AgentGraph runId={run.id} run={run} variant="page" live />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Steps</h2>
        {run.steps.length === 0 ? (
          <p className="text-sm text-muted animate-agent-pulse">Getting started…</p>
        ) : (
          <StepTimeline steps={run.steps} playback={settledPlayback(run)} />
        )}
      </section>

      {script && (
        <section>
          <h2 className="mb-4 text-sm font-semibold">Scene script</h2>
          <SceneList script={script} />
        </section>
      )}
      {answers && Object.keys(answers).length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold">Your answers</h2>
          <AnswerList answers={answers} script={script} />
        </section>
      )}
    </div>
  );
}

/** Everything shown at once; a running last step shows as "Working…". */
function settledPlayback(run: RunView): Playback {
  const last = run.steps.at(-1);
  if (last?.status === "running") return { index: run.steps.length - 1, chars: 0, items: 0, complete: false };
  return { index: run.steps.length, chars: 0, items: 0, complete: isFinished(run) };
}

function SceneList({ script }: { script: SceneScript }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {script.scenes.map((scene, i) => (
        <li key={`${scene.id}-${i}`} className="flex gap-4 py-4">
          <AgentIcon agent={scene.agent} size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-fg">{scene.agent}</span>
              <span>Scene {i}: {scene.id}</span>
              {scene.interaction && <Badge variant="primary">{scene.interaction.type}</Badge>}
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg/85">
              <Highlighted text={scene.speech} highlights={scene.captionHighlights} />
            </p>
            {scene.interaction?.options && scene.interaction.options.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {scene.interaction.options.map((o) => (
                  <li key={o.id}><Badge>{o.label}</Badge></li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function Highlighted({ text, highlights }: { text: string; highlights: string[] }) {
  const terms = highlights.filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.map(escape).join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{terms.includes(part) ? <strong className="font-semibold text-fg">{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}

function AnswerList({ answers, script }: { answers: BriefingAnswers; script: SceneScript | null }) {
  const options = script?.scenes.flatMap((s: Scene) => s.interaction?.options ?? []) ?? [];
  const decision = (d: { decision: string; via: string }) => `${d.decision === "confirm" ? "Yes" : "Not now"} · by ${d.via}`;
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (answers.catch) rows.push({ label: "The catch", value: decision(answers.catch) });
  if (answers.pick) rows.push({ label: "Picked", value: `${options.find((o) => o.id === answers.pick?.choiceId)?.label ?? answers.pick.choiceId} · by ${answers.pick.via}` });
  if (answers.planSpeech) rows.push({ label: "Day plan", value: answers.planSpeech });
  answers.standupEdits?.forEach((edit, i) => rows.push({ label: `Standup edit ${i + 1}`, value: `“${edit.instruction}”` }));
  if (answers.standupFinal?.length)
    rows.push({ label: "Final standup", value: <ul className="space-y-0.5">{answers.standupFinal.map((line, i) => <li key={i}>{line}</li>)}</ul> });
  if (answers.post) rows.push({ label: "Post to Slack", value: decision(answers.post) });
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {rows.map((row) => (
        <Fragment key={row.label}>
          <dt className="text-muted">{row.label}</dt>
          <dd className="min-w-0 text-fg/85">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
