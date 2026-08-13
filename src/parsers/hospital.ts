import type { ActivityObservation } from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import {
  extractHospitalClockText,
  normalizeWs,
  parseHmsDurationMs,
} from './clock.js';

export type HospitalParseResult = {
  observations: ActivityObservation[];
  diagnostics: string[];
};

function slug(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function nameKey(name: string): string {
  return encodeURIComponent(name.normalize('NFKC').toLocaleLowerCase('en-US'));
}

/**
 * Best-effort Hospital Volunteer parser.
 * - Stores active + ready only (not per-shift available Join Shift noise).
 * - Clock from digit spans only (ignores inline script in .vc-fight-time).
 * - Remaining time is a focused-tab snapshot only.
 */
export function parseHospital(
  document: Document,
  observedAt: number,
): HospitalParseResult {
  const observations: ActivityObservation[] = [];
  const diagnostics: string[] = [];

  let cards: Element[];
  try {
    cards = Array.from(document.querySelectorAll('.vc-fight-details'));
  } catch {
    return { observations: [], diagnostics: ['dom-query-failed'] };
  }

  if (cards.length === 0) {
    return { observations: [], diagnostics: ['no-shift-cards'] };
  }

  for (const card of cards) {
    const titleRaw =
      normalizeWs(
        card.querySelector('.vc-title')?.getAttribute('title') ??
          card.querySelector('.vc-title')?.textContent ??
          '',
      ) || '';
    // Placeholder cards titled ???? — skip
    if (!titleRaw || /^\?+$/.test(titleRaw)) {
      continue;
    }
    const title = titleRaw;

    const statusLabel = normalizeWs(
      card.querySelector('.vc-status')?.textContent ?? '',
    );
    const petName = normalizeWs(
      card.querySelector('.vc-pet-name')?.textContent ?? '',
    );
    const buttonText = normalizeWs(
      card.querySelector('button')?.textContent ?? '',
    );
    const fightEl = card.closest('.vc-fight') ?? card;
    const isFinishedClass =
      fightEl.classList.contains('finished') ||
      card.classList.contains('finished');

    // Ready: Collect Prize (server reload), Complete (client zero), or finished class
    if (
      /collect\s+prize/i.test(buttonText) ||
      /^complete$/i.test(buttonText) ||
      isFinishedClass
    ) {
      const subject = petName || title;
      observations.push({
        kind: 'hospital',
        idKey: `${slug(title)}:${nameKey(subject)}`,
        subject,
        contextLabel: title,
        observedAt,
        dueAt: observedAt,
        status: 'ready',
        activityStatus: 'ready',
        timerQuality: 'none',
        sourceNote: isFinishedClass
          ? 'Finished class snapshot'
          : /complete/i.test(buttonText)
            ? 'Complete control visible (client zero)'
            : 'Collect Prize visible (focused snapshot)',
        parserVersion: PARSER_VERSION,
      });
      continue;
    }

    // Active: Time Remaining + pet volunteering (+ Cancel typical)
    if (/time\s+remaining/i.test(statusLabel) && petName) {
      const timeRoot = card.querySelector('.vc-fight-time');
      const clockText = extractHospitalClockText(timeRoot);
      const ms = clockText ? parseHmsDurationMs(clockText) : null;
      if (ms === null) {
        diagnostics.push('skip-unparseable-hospital-clock');
        continue;
      }
      if (ms === 0) {
        observations.push({
          kind: 'hospital',
          idKey: `${slug(title)}:${nameKey(petName)}`,
          subject: petName,
          contextLabel: title,
          observedAt,
          dueAt: observedAt,
          status: 'ready',
          activityStatus: 'ready',
          timerQuality: 'none',
          sourceNote: 'Zero remaining snapshot',
          parserVersion: PARSER_VERSION,
        });
        continue;
      }
      observations.push({
        kind: 'hospital',
        idKey: `${slug(title)}:${nameKey(petName)}`,
        subject: petName,
        contextLabel: title,
        observedAt,
        dueAt: observedAt + ms,
        status: 'scheduled',
        activityStatus: 'active',
        timerQuality: 'snapshot',
        sourceNote:
          'Focused-tab remaining snapshot only; unreliable if tab was backgrounded',
        parserVersion: PARSER_VERSION,
      });
      continue;
    }

    // Available Join Shift: do NOT persist per-shift noise
    if (
      /join\s+shift/i.test(buttonText) ||
      /volunteer\s+time\s+needed/i.test(statusLabel)
    ) {
      continue;
    }

    // Unrecognized empty shells — skip quietly
  }

  return { observations, diagnostics };
}
