import type { ActivityObservation } from '../shared/types.js';
import {
  HEALING_SPRINGS_COOLDOWN_MS,
  PARSER_VERSION,
} from '../shared/types.js';
import { normalizeWs } from './clock.js';

export type HealingSpringsParseResult = {
  observations: ActivityObservation[];
  diagnostics: string[];
};

/**
 * Best-effort Healing Springs parser.
 * - success: Water Faerie result dialogue present (outcome text may vary)
 * - cooldown: fixed "magic is not fully restored" failure copy
 * - available: Heal my Pets control
 * Never uses .faerie-battle alone as success.
 * observedAt+30m is local best-effort policy, not server precision.
 */
export function parseHealingSprings(
  document: Document,
  observedAt: number,
): HealingSpringsParseResult {
  const diagnostics: string[] = [];
  const bodyText = normalizeWs(document.body?.textContent ?? '');

  try {
    const hasHealButton = Array.from(
      document.querySelectorAll('input[type="submit"], button'),
    ).some((el) => /heal\s+my\s+pets/i.test(el.getAttribute('value') ?? el.textContent ?? ''));

    const hasCooldown =
      /magic\s+is\s+not\s+fully\s+restored/i.test(bodyText) ||
      (/sorry!/i.test(bodyText) && /try\s+back\s+later/i.test(bodyText));

    const hasFaerieLead =
      /the\s+water\s+faerie\s+says\s+a\s+few\s+magical\s+words/i.test(bodyText);

    // Success: faerie lead-in + a following result paragraph (not cooldown)
    if (hasFaerieLead && !hasCooldown) {
      // Confirm there is more than just the lead-in (some result text)
      const paragraphs = Array.from(document.querySelectorAll('p')).map((p) =>
        normalizeWs(p.textContent ?? ''),
      );
      const hasResultLine = paragraphs.some(
        (t) =>
          t.length > 0 &&
          !/water\s+faerie\s+says/i.test(t) &&
          !/healingsprings|page-title/i.test(t),
      );
      if (!hasResultLine) {
        return {
          observations: [],
          diagnostics: ['hs-unknown-faerie-without-result'],
        };
      }
      return {
        observations: [
          {
            kind: 'healing-springs',
            idKey: 'self',
            subject: 'Healing Springs',
            contextLabel: 'Healing Springs',
            observedAt,
            dueAt: observedAt + HEALING_SPRINGS_COOLDOWN_MS,
            status: 'scheduled',
            activityStatus: 'cooldown',
            timerQuality: 'estimate',
            sourceNote:
              'Local best-effort 30m after observed success (not server-precise)',
            parserVersion: PARSER_VERSION,
          },
        ],
        diagnostics: [],
      };
    }

    if (hasCooldown) {
      return {
        observations: [
          {
            kind: 'healing-springs',
            idKey: 'self',
            subject: 'Healing Springs',
            contextLabel: 'Healing Springs',
            observedAt,
            dueAt: observedAt + HEALING_SPRINGS_COOLDOWN_MS,
            status: 'scheduled',
            activityStatus: 'cooldown',
            timerQuality: 'estimate',
            sourceNote:
              'Cooldown page with no numeric remaining; estimate within ~30m if no fresher success',
            parserVersion: PARSER_VERSION,
          },
        ],
        diagnostics: [],
      };
    }

    if (hasHealButton) {
      return {
        observations: [
          {
            kind: 'healing-springs',
            idKey: 'self',
            subject: 'Healing Springs',
            contextLabel: 'Healing Springs',
            observedAt,
            dueAt: observedAt,
            status: 'ready',
            activityStatus: 'available',
            timerQuality: 'none',
            sourceNote: 'Heal control available; no timer',
            parserVersion: PARSER_VERSION,
          },
        ],
        diagnostics: [],
      };
    }

    diagnostics.push('hs-unknown-dom');
    return {
      observations: [
        {
          kind: 'healing-springs',
          idKey: 'self',
          subject: 'Healing Springs',
          contextLabel: 'Healing Springs',
          observedAt,
          dueAt: observedAt,
          status: 'ready',
          activityStatus: 'unknown',
          timerQuality: 'none',
          sourceNote: 'Could not classify page; no timer created',
          parserVersion: PARSER_VERSION,
        },
      ],
      diagnostics,
    };
  } catch {
    return { observations: [], diagnostics: ['dom-query-failed'] };
  }
}
