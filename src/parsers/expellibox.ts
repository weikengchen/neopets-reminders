import type { ActivityObservation } from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import { expelliboxDueAtUtcMs } from '../shared/nst.js';
import { normalizeWs } from './clock.js';

export type ExpelliboxParseResult = {
  observations: ActivityObservation[];
  diagnostics: string[];
  /** True when light DOM is already cooldown (no leave-assumption needed). */
  isCooldown: boolean;
  /** True when page looks playable / not cooldown (visit-leave may start timer). */
  isPlayableVisit: boolean;
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
    kind: 'expellibox',
    idKey: 'self',
    subject: 'Qasalan Expellibox',
    contextLabel: 'Qasalan Expellibox',
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
 * Expellibox light-DOM parser.
 * Canvas success is unreadable; playable visit + leave assumes play (7h7m).
 */
export function parseExpellibox(
  document: Document,
  observedAt: number,
): ExpelliboxParseResult {
  const diagnostics: string[] = [];
  try {
    const text = normalizeWs(document.body?.textContent ?? '');
    // Cooldown first (same role as HS cooldown): start local ≤7h7m estimate.
    // Never classify these pages as unknown.
    const isCooldown =
      /bring\s+that\s+scarab\s+back\s+tomorrow/i.test(text) ||
      (/what\s+are\s+you\s+doing/i.test(text) &&
        /series\s+of\s+tubes/i.test(text)) ||
      (/scarab/i.test(text) &&
        /tomorrow/i.test(text) &&
        /deposit/i.test(text) &&
        !/start\s+game/i.test(text));

    if (isCooldown) {
      const dueAt = expelliboxDueAtUtcMs(observedAt);
      return {
        observations: [
          base(
            observedAt,
            'cooldown',
            'estimate',
            'scheduled',
            dueAt,
            'Cooldown page; local estimate ready within ≤7h7m (JN interval)',
          ),
        ],
        diagnostics: [],
        isCooldown: true,
        isPlayableVisit: false,
      };
    }

    const hasRuffle =
      !!document.querySelector('#show_NCGiveawayGame') ||
      !!document.querySelector('ruffle-embed');
    const hasPlayableCopy =
      /deposit\s+it\s+into\s+the\s+qasalan/i.test(text) ||
      (/qasalan\s+expellibox/i.test(text) && /scarab/i.test(text));

    if (hasRuffle || hasPlayableCopy) {
      return {
        observations: [],
        diagnostics: [],
        isCooldown: false,
        isPlayableVisit: true,
      };
    }

    diagnostics.push('expellibox-unknown-dom');
    return {
      observations: [
        base(
          observedAt,
          'unknown',
          'none',
          'ready',
          observedAt,
          'Could not classify Expellibox page',
        ),
      ],
      diagnostics,
      isCooldown: false,
      isPlayableVisit: false,
    };
  } catch {
    return {
      observations: [],
      diagnostics: ['dom-query-failed'],
      isCooldown: false,
      isPlayableVisit: false,
    };
  }
}

/** Build leave-assumption observation after a playable visit. */
export function expelliboxLeaveAssumption(
  leaveAt: number,
): ActivityObservation {
  return base(
    leaveAt,
    'cooldown',
    'estimate',
    'scheduled',
    expelliboxDueAtUtcMs(leaveAt),
    'Assumed played after non-cooldown visit + leave; +7h7m estimate',
  );
}
