/** Timezone-aware helpers so the plan follows the user's day, not the server's. */

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function safeZone(tz: string | undefined) {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function parts(date: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

function offsetMs(instant: number, tz: string) {
  const p = parts(new Date(instant), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

/** The instant at local "HH:MM" on the same local day as `date` in `tz`. */
export function atLocal(date: Date, hhmm: string, tz: string) {
  const p = parts(date, tz);
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(p.year, p.month - 1, p.day, h, m || 0);
  const first = guess - offsetMs(guess, tz);
  return new Date(guess - offsetMs(first, tz));
}

export const startOfLocalDay = (date: Date, tz: string) => atLocal(date, "00:00", tz);

/** "2026-10-25" for the local day of `date`. */
export function localDateISO(date: Date, tz: string) {
  const p = parts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Spoken time: "9:00", "10:30", "2 pm", "4:15 pm" — morning times stay short. */
export function spokenTime(iso: string | Date, tz: string) {
  const p = parts(new Date(iso), tz);
  const mm = String(p.minute).padStart(2, "0");
  if (p.hour < 12) return `${p.hour}:${mm}`;
  const h = p.hour === 12 ? 12 : p.hour - 12;
  return p.minute ? `${h}:${mm} pm` : `${h} pm`;
}

/** Clock time for cards: "14:00". */
export function clockTime(iso: string | Date, tz: string) {
  const p = parts(new Date(iso), tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export const minutesBetween = (a: string | Date, b: string | Date) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
