/**
 * Expellibox observation controller (pure scheduling decisions + side-effect hooks).
 * Extracted for unit tests without a full browser.
 *
 * Live pages fill #main_div via async XHR (~5s). We re-read local DOM on a
 * short interval until classified or the tab closes — never fetch/XHR ourselves.
 */
import type { ExpelliboxParseResult } from '../parsers/expellibox.js';
import { expelliboxLeaveAssumption } from '../parsers/expellibox.js';
import type { ActivityObservation } from '../shared/types.js';

/** How often to re-parse the already-loaded document (local DOM only). */
export const EXPELLIBOX_POLL_MS = 1000;

/**
 * Safety cap so a forever-unknown tab does not poll for hours.
 * ~3 minutes at 1s interval. Cleared earlier on success or pagehide.
 */
export const EXPELLIBOX_POLL_MAX_MS = 180_000;

export type ExpelliboxObserveAction =
  | { type: 'send'; observations: ActivityObservation[]; replaceScope: boolean }
  | { type: 'arm-leave' }
  | { type: 'continue-polling' }
  | { type: 'stop' };

export type ExpelliboxPollPhase = 'polling' | 'final';

/**
 * Decide what to do with a parse result during active polling or final tick.
 */
export function decideExpelliboxAction(
  result: ExpelliboxParseResult,
  phase: ExpelliboxPollPhase,
): ExpelliboxObserveAction {
  if (result.isCooldown) {
    return {
      type: 'send',
      observations: result.observations,
      replaceScope: true,
    };
  }

  if (result.isPlayableVisit) {
    return { type: 'arm-leave' };
  }

  // Still unknown / empty shell
  if (phase === 'polling') {
    return { type: 'continue-polling' };
  }

  // Final attempt after max window or forced stop
  if (result.observations.length > 0) {
    return {
      type: 'send',
      observations: result.observations,
      replaceScope: true,
    };
  }

  return { type: 'stop' };
}

export function buildLeaveObservation(leaveAt: number): ActivityObservation {
  return expelliboxLeaveAssumption(leaveAt);
}
