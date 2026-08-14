/**
 * Neopia Standard Time (NST) ≈ US Pacific Time (America/Los_Angeles).
 * Community consensus: same as California local time, including PDT/PST shifts.
 * Sources: Neopets Wiki "Neopian Standard Time"; Jellyneo dailies clock.
 */

export const NST_TIME_ZONE = 'America/Los_Angeles';

/** Coltzan's Shrine daily reset ~12:26 AM NST (Jellyneo). */
export const COLTZAN_RESET_HOUR_NST = 0;
export const COLTZAN_RESET_MINUTE_NST = 26;

export const COLTZAN_COOLDOWN_MS = 13 * 60 * 60 * 1000;
export const EXPELLIBOX_COOLDOWN_MS = (7 * 60 + 7) * 60 * 1000;
export const METEOR_VISIT_COOLDOWN_MS = 60 * 60 * 1000;

function partsInNst(ms: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: NST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Convert a civil wall-clock time in NST to UTC epoch ms via binary search.
 */
export function nstWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  // Rough guess: Pacific is UTC-8 or UTC-7
  let lo = Date.UTC(year, month - 1, day, hour + 6, minute, second) - 12 * 3_600_000;
  let hi = Date.UTC(year, month - 1, day, hour + 10, minute, second) + 12 * 3_600_000;

  for (let i = 0; i < 48; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = partsInNst(mid);
    const cmp =
      p.year !== year
        ? p.year - year
        : p.month !== month
          ? p.month - month
          : p.day !== day
            ? p.day - day
            : p.hour !== hour
              ? p.hour - hour
              : p.minute !== minute
                ? p.minute - minute
                : p.second - second;
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return Math.floor((lo + hi) / 2);
}

function addNstCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  // Use noon UTC as anchor then read NST date after offsetting days in ms
  const noonGuess = nstWallTimeToUtcMs(year, month, day, 12, 0, 0);
  const shifted = noonGuess + deltaDays * 24 * 60 * 60 * 1000;
  const p = partsInNst(shifted);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Next Coltzan daily reset at ~12:26 AM NST strictly after `fromMs`.
 * If `fromMs` is exactly on the reset instant, returns the following day's reset.
 */
export function nextColtzanResetUtcMs(fromMs: number): number {
  const p = partsInNst(fromMs);
  let y = p.year;
  let m = p.month;
  let d = p.day;

  let candidate = nstWallTimeToUtcMs(
    y,
    m,
    d,
    COLTZAN_RESET_HOUR_NST,
    COLTZAN_RESET_MINUTE_NST,
    0,
  );

  if (candidate <= fromMs) {
    const next = addNstCalendarDays(y, m, d, 1);
    y = next.year;
    m = next.month;
    d = next.day;
    candidate = nstWallTimeToUtcMs(
      y,
      m,
      d,
      COLTZAN_RESET_HOUR_NST,
      COLTZAN_RESET_MINUTE_NST,
      0,
    );
  }
  return candidate;
}

/**
 * Jellyneo Coltzan timing:
 * next approach = min(last + 13h, next ~12:26am NST after last).
 * Examples (JN): 7:01am → 8:01pm same day; 9:05pm → ~12:26am next day.
 */
export function coltzanDueAtUtcMs(observedAt: number): number {
  const plus13 = observedAt + COLTZAN_COOLDOWN_MS;
  const reset = nextColtzanResetUtcMs(observedAt);
  return Math.min(plus13, reset);
}

export function expelliboxDueAtUtcMs(observedAt: number): number {
  return observedAt + EXPELLIBOX_COOLDOWN_MS;
}

/** Next 00:00 NST strictly after fromMs. */
export function nextNstMidnightUtcMs(fromMs: number): number {
  const p = partsInNst(fromMs);
  let y = p.year;
  let m = p.month;
  let d = p.day;
  let candidate = nstWallTimeToUtcMs(y, m, d, 0, 0, 0);
  if (candidate <= fromMs) {
    const next = addNstCalendarDays(y, m, d, 1);
    y = next.year;
    m = next.month;
    d = next.day;
    candidate = nstWallTimeToUtcMs(y, m, d, 0, 0, 0);
  }
  return candidate;
}

export function meteorVisitDueAtUtcMs(observedAt: number): number {
  return observedAt + METEOR_VISIT_COOLDOWN_MS;
}

export function meteorPrizeDueAtUtcMs(observedAt: number): number {
  return nextNstMidnightUtcMs(observedAt);
}
