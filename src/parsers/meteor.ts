import type { ActivityObservation } from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import {
  meteorPrizeDueAtUtcMs,
  meteorVisitDueAtUtcMs,
} from '../shared/nst.js';
import { normalizeWs } from './clock.js';

export type MeteorParseResult = {
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
  prizeWonToday?: boolean,
): ActivityObservation {
  const obs: ActivityObservation = {
    kind: 'meteor',
    idKey: 'self',
    subject: 'Meteor Crash Site',
    contextLabel: 'Meteor Crash Site 725-XZ',
    observedAt,
    dueAt,
    status,
    activityStatus,
    timerQuality,
    sourceNote,
    parserVersion: PARSER_VERSION,
  };
  if (prizeWonToday !== undefined) obs.prizeWonToday = prizeWonToday;
  return obs;
}

/**
 * Meteor Crash Site — HS-style estimates from captured fixtures.
 * too-hot / scientist-away are not implemented (no fixtures).
 */
export function parseMeteor(
  document: Document,
  observedAt: number,
): MeteorParseResult {
  const diagnostics: string[] = [];
  try {
    const text = normalizeWs(document.body?.textContent ?? '');

    const hasPrize =
      /the\s+meteor\s+has\s+cracked\s+open/i.test(text) ||
      /a\s+small\s+object\s+falls\s+out/i.test(text);
    if (hasPrize) {
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            meteorPrizeDueAtUtcMs(observedAt),
            'Prize observed; next eligible ≈ next NST midnight (local estimate)',
            true,
          ),
        ],
        diagnostics: [],
      };
    }

    const hasMiss =
      /try\s+again\s+later/i.test(text) ||
      /don'?t\s+feel\s+like\s+company/i.test(text) ||
      /must\s+not\s+be\s+your\s+lucky\s+day/i.test(text) ||
      /meteor\s+just\s+disappeared/i.test(text);
    if (hasMiss) {
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            meteorVisitDueAtUtcMs(observedAt),
            'No prize; +60m visit cooldown (local estimate)',
            false,
          ),
        ],
        diagnostics: [],
      };
    }

    // Cooldown page: "It's gone!" without miss/prize copy
    if (/it'?s\s+gone!/i.test(text)) {
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            meteorVisitDueAtUtcMs(observedAt),
            "Cooldown copy (It's gone!); +60m estimate if no fresher visit",
            false,
          ),
        ],
        diagnostics: [],
      };
    }

    const hasActionSelect =
      /poke\s+the\s+meteor\s+with\s+a\s+stick/i.test(text) ||
      /what\s+to\s+do\s+next/i.test(text);
    if (hasActionSelect) {
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            meteorVisitDueAtUtcMs(observedAt),
            'Take a chance already taken; +60m from this step (local estimate)',
            false,
          ),
        ],
        diagnostics: [],
      };
    }

    const hasTakeChance = Array.from(
      document.querySelectorAll('button, input[type="submit"]'),
    ).some((el) =>
      /take\s+a\s+chance/i.test(el.getAttribute('value') ?? el.textContent ?? ''),
    );
    if (hasTakeChance || /what\s+is\s+that\s+glowing\s+in\s+the\s+distance/i.test(text)) {
      return {
        observations: [
          base(
            observedAt,
            'available',
            'none',
            'ready',
            observedAt,
            'Take a chance available; no timer',
          ),
        ],
        diagnostics: [],
      };
    }

    diagnostics.push('meteor-unknown-dom');
    return {
      observations: [
        base(
          observedAt,
          'unknown',
          'none',
          'ready',
          observedAt,
          'Could not classify Meteor page; no timer',
        ),
      ],
      diagnostics,
    };
  } catch {
    return { observations: [], diagnostics: ['dom-query-failed'] };
  }
}
