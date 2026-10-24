import type { StandupDraft } from "@/nudge/briefing";

export const STANDUP_SECTIONS = [
  { key: "yesterday", title: "Yesterday" },
  { key: "today", title: "Today" },
  { key: "blockers", title: "Blockers" },
] as const;

const HEADERS: Record<string, keyof StandupDraft> = { "yesterday:": "yesterday", "today:": "today", "blockers:": "blockers" };

/** ["Yesterday:", …, "Today:", …, "Blockers:", …] (the /answer diff format) back into a draft. */
export function linesToStandup(lines: string[]): StandupDraft {
  const out: StandupDraft = { yesterday: [], today: [], blockers: [] };
  let section: keyof StandupDraft = "yesterday";
  for (const raw of lines) {
    const line = raw.trim();
    const header = HEADERS[line.toLowerCase()];
    if (header) section = header;
    else if (line && !(section === "blockers" && /^none\.?$/i.test(line))) out[section].push(line);
  }
  return out;
}

export function standupToLines(s: StandupDraft) {
  return ["Yesterday:", ...s.yesterday, "Today:", ...s.today, "Blockers:", ...(s.blockers.length ? s.blockers : ["None"])];
}

/** Plain text for the editor and the Copy button. */
export function standupToPlain(s: StandupDraft) {
  return STANDUP_SECTIONS.map(({ key, title }) => `${title}:\n${(s[key].length ? s[key] : ["None"]).map((l) => `- ${l}`).join("\n")}`).join("\n\n");
}

export function plainToStandup(text: string): StandupDraft {
  return linesToStandup(text.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "")));
}

export type DiffLine = { text: string; kind: "same" | "removed" | "added" };

/** Line diff (LCS) between two standup line lists, in reading order. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      out.push({ text: before[i], kind: "same" });
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) out.push({ text: after[j++], kind: "added" });
    else out.push({ text: before[i++], kind: "removed" });
  }
  return out;
}

/** What Nudge says after a replayed edit, rebuilt from the saved lines (no model call). */
export function editSummary(before: string[], after: string[]) {
  const removed = before.filter((l) => !after.includes(l) && l !== "None");
  const added = after.filter((l) => !before.includes(l) && l !== "None");
  const quote = (l: string) => (l.length > 60 ? `${l.slice(0, 57)}…` : l);
  if (!removed.length && !added.length) return "No change there. Anything else?";
  return `${removed.length && added.length ? `Changed it to "${quote(added[0])}".` : removed.length ? `Removed "${quote(removed[0])}".` : `Added "${quote(added[0])}".`} Anything else?`;
}
