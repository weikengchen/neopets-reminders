/**
 * Parse HH:MM:SS style remaining clocks (Hospital digit spans collapse to this).
 */
export function parseHmsDurationMs(text: string): number | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/\s+/g, '');
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(cleaned);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3]);
  if (![h, min, s].every((n) => Number.isFinite(n) && n >= 0)) return null;
  if (min > 59 || s > 59) return null;
  return ((h * 60 + min) * 60 + s) * 1000;
}

export function normalizeWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Hospital live `.vc-fight-time` includes digit spans plus an inline <script>
 * whose textContent pollutes the parent. Only direct element children that are
 * single-digit (or colon) display nodes are used — never script bodies.
 */
export function extractHospitalClockText(timeRoot: Element | null): string | null {
  if (!timeRoot) return null;

  const parts: string[] = [];
  for (const child of Array.from(timeRoot.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
    if (tag !== 'span') continue;
    const t = normalizeWs(child.textContent ?? '');
    if (t === ':' || t === '') {
      if (t === ':') parts.push(':');
      continue;
    }
    // digit span: single digit 0-9 (live uses one digit per span)
    if (/^\d$/.test(t)) {
      parts.push(t);
      continue;
    }
    // already-collapsed small token
    if (/^\d{1,2}$/.test(t)) {
      parts.push(t);
    }
  }

  // Expected 6 digits with colons optional between pairs from markup separators
  const digits = parts.filter((p) => p !== ':').join('');
  if (digits.length === 6 && /^\d{6}$/.test(digits)) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
  }

  // Fallback: only if children already formed HH:MM:SS without script noise
  const joined = parts.join('');
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(joined)) return joined;

  return null;
}
