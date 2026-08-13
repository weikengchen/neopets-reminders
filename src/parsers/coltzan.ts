import type { ActivityObservation } from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import { coltzanDueAtUtcMs } from '../shared/nst.js';
import { normalizeWs } from './clock.js';

export type ColtzanParseResult = {
  observations: ActivityObservation[];
  diagnostics: string[];
};

function base(
  observedAt: number,
  activityStatus: ActivityObservation['activityStatus'],
  timerQuality: ActivityObservation['timerQuality'],
  status: ActivityObservation['status'],
  dueAt: number,
  sourceNote: string,
): ActivityObservation {
  return {
    kind: 'coltzan',
    idKey: 'self',
    subject: "Coltzan's Shrine",
    contextLabel: "Coltzan's Shrine",
    observedAt,
    dueAt,
    status,
    activityStatus,
    timerQuality,
    sourceNote,
    parserVersion: PARSER_VERSION,
  };
}

/**
 * Coltzan's Shrine — HS-style fixed cooldown from fixtures.
 * - available: Approach the Shrine
 * - cooldown: wait a while...
 * - success: any completed visit (prize or random nothing) without wait-a-while
 */
export function parseColtzan(
  document: Document,
  observedAt: number,
): ColtzanParseResult {
  const diagnostics: string[] = [];
  try {
    const text = normalizeWs(document.body?.textContent ?? '');

    if (/wait\s+a\s+while\s+before\s+visiting\s+the\s+shrine\s+again/i.test(text)) {
      const dueAt = coltzanDueAtUtcMs(observedAt);
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            dueAt,
            'Cooldown copy; dueAt = min(+13h, next ~12:26 NST) estimate (JN)',
          ),
        ],
        diagnostics: [],
      };
    }

    const hasApproach = Array.from(
      document.querySelectorAll('input[type="submit"], button'),
    ).some((el) =>
      /approach\s+the\s+shrine/i.test(
        el.getAttribute('value') ?? el.textContent ?? '',
      ),
    );

    if (hasApproach) {
      return {
        observations: [
          base(
            observedAt,
            'available',
            'none',
            'ready',
            observedAt,
            'Approach available; no timer',
          ),
        ],
        diagnostics: [],
      };
    }

    // Completed visit markers (success with or without prize)
    const looksVisited =
      /walks\s+slowly\s+up\s+to\s+the\s+strange\s+shrine/i.test(text) ||
      /shrine-scene/i.test(document.body?.innerHTML ?? '') ||
      /nothing\s+happened/i.test(text) ||
      /feel\s+slightly\s+richer/i.test(text) ||
      /coltzan\s+has\s+granted/i.test(text) ||
      /appears\s+in\s+front\s+of\s+you/i.test(text) ||
      /lying\s+in\s+the\s+sand/i.test(text);

    if (looksVisited) {
      const dueAt = coltzanDueAtUtcMs(observedAt);
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            dueAt,
            'Visit completed; dueAt = min(+13h, next ~12:26 NST) estimate (JN)',
          ),
        ],
        diagnostics: [],
      };
    }

    diagnostics.push('coltzan-unknown-dom');
    return {
      observations: [
        base(
          observedAt,
          'unknown',
          'none',
          'ready',
          observedAt,
          'Could not classify Shrine page',
        ),
      ],
      diagnostics,
    };
  } catch {
    return { observations: [], diagnostics: ['dom-query-failed'] };
  }
}
