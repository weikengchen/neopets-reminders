/**
 * Parse human-readable Training duration text into milliseconds.
 * Returns null for malformed, negative, duplicated, or unitless values.
 */
const UNIT_MS: Record<string, number> = {
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  sec: 1_000,
  secs: 1_000,
  second: 1_000,
  seconds: 1_000,
};

const TOKEN_RE =
  /(\d+)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;

export function parseDurationMs(text: string): number | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim();
  if (!cleaned) return null;

  // Reject bare numbers without units
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  // Reject any explicit negative sign
  if (/-/.test(cleaned)) return null;

  const seenFamilies = new Set<string>();
  let total = 0;
  let matched = false;

  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(cleaned)) !== null) {
    matched = true;
    const amount = Number(m[1]);
    const unitRaw = (m[2] ?? '').toLowerCase();
    if (!Number.isFinite(amount) || amount < 0) return null;

    const ms = UNIT_MS[unitRaw];
    if (ms === undefined) return null;

    const family =
      unitRaw.startsWith('h') ? 'h' : unitRaw.startsWith('m') ? 'm' : 's';
    if (seenFamilies.has(family)) return null; // duplicated unit family
    seenFamilies.add(family);

    total += amount * ms;
  }

  if (!matched) return null;

  // Reject leftover suspicious numeric tokens without units (e.g. "2 hrs 5")
  const stripped = cleaned
    .replace(TOKEN_RE, ' ')
    .replace(/[,\s]+/g, ' ')
    .trim();
  if (/\d/.test(stripped)) return null;

  return total;
}
