import type { ActivityObservation } from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import { normalizeWs } from './clock.js';
import { parseDurationMs } from './duration.js';

export type GraveDangerPageKind = 'active' | 'end' | 'selection' | 'unknown';

export type GraveDangerParseResult = {
  pageKind: GraveDangerPageKind;
  observations: ActivityObservation[];
  diagnostics: string[];
  /** True only for fixture-backed end/selection — clear stale GD scope. */
  shouldClearScope: boolean;
};

/**
 * Best-effort Grave Danger parser.
 * - active: #gdAdventure/#gdActive + parseable #gdRemaining
 * - end: #gdReward (live 2026-08-13)
 * - selection: #gdSelection + POST #gdForm (live 2026-08-13)
 * - unknown / no-petpet: do not clear scope
 */
export function parseGraveDanger(
  document: Document,
  observedAt: number,
): GraveDangerParseResult {
  const diagnostics: string[] = [];
  const observations: ActivityObservation[] = [];

  try {
    const remainingEl = document.querySelector('#gdRemaining');
    const nameEl = document.querySelector('.petpetName');
    const active = document.querySelector('#gdActive, #gdAdventure');

    if (active) {
      const petpet = normalizeWs(nameEl?.textContent ?? '') || 'Petpet';
      const remainingText = normalizeWs(remainingEl?.textContent ?? '');
      const ms = remainingEl ? parseDurationMs(remainingText) : null;
      if (ms === null) {
        return {
          pageKind: 'active',
          observations: [],
          diagnostics: ['skip-unparseable-gd-remaining'],
          shouldClearScope: false,
        };
      }

      const key = encodeURIComponent(
        petpet.normalize('NFKC').toLocaleLowerCase('en-US'),
      );
      observations.push({
        kind: 'grave-danger',
        idKey: key,
        subject: petpet,
        contextLabel: 'Grave Danger',
        observedAt,
        dueAt: observedAt + ms,
        status: 'scheduled',
        activityStatus: 'active',
        timerQuality: 'snapshot',
        sourceNote:
          'Remaining adventuring time snapshot at observe (local estimate afterward)',
        parserVersion: PARSER_VERSION,
      });
      return {
        pageKind: 'active',
        observations,
        diagnostics,
        shouldClearScope: false,
      };
    }

    if (document.querySelector('#gdReward')) {
      return {
        pageKind: 'end',
        observations: [],
        diagnostics: [],
        shouldClearScope: true,
      };
    }

    const selection = document.querySelector('#gdSelection');
    const form = document.querySelector('#gdForm');
    const method = (form?.getAttribute('method') ?? 'get').toLowerCase();
    const isPostForm =
      !!form && form.tagName.toLowerCase() === 'form' && method === 'post';
    if (selection && isPostForm) {
      return {
        pageKind: 'selection',
        observations: [],
        diagnostics: [],
        shouldClearScope: true,
      };
    }

    return {
      pageKind: 'unknown',
      observations: [],
      diagnostics: [
        'grave-danger-unknown: no active/end/selection markers; not clearing scope',
      ],
      shouldClearScope: false,
    };
  } catch {
    diagnostics.push('dom-query-failed');
    return {
      pageKind: 'unknown',
      observations: [],
      diagnostics,
      shouldClearScope: false,
    };
  }
}
