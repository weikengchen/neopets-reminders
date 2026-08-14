/**
 * Unified content script — observe only.
 * Runs at document_idle on allowlisted pages.
 * No fetch, reload, mutation, gameplay clicks from this script.
 *
 * Expellibox: site fills #main_div via its own XHR (~5s). We only re-read
 * local DOM on a short interval until cooldown/playable or the tab closes.
 */
import {
  buildLeaveObservation,
  decideExpelliboxAction,
  EXPELLIBOX_POLL_MAX_MS,
  EXPELLIBOX_POLL_MS,
} from './expellibox-observe.js';
import { parseColtzan } from '../parsers/coltzan.js';
import { parseExpellibox } from '../parsers/expellibox.js';
import { parseMeteor } from '../parsers/meteor.js';
import { GraveDangerWaiter } from './grave-danger-observe.js';
import { HospitalReobserver } from './hospital-observe.js';
import { parseHealingSprings } from '../parsers/healing-springs.js';
import { parseTraining } from '../parsers/training.js';
import type { ContentMessage } from '../shared/messages.js';
import type { ObservationScope } from '../shared/scope-reconcile.js';
import type { ActivityObservation } from '../shared/types.js';
import { classifyPageUrl } from '../shared/url-allowlist.js';

function sendActivities(
  observations: ActivityObservation[],
  scope: ObservationScope,
  replaceScope: boolean,
): void {
  if (!replaceScope && observations.length === 0) return;
  const message: ContentMessage = {
    type: 'ACTIVITY_OBSERVED',
    observations,
    replaceScope,
    scope,
  };
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // Extension context invalidated
  }
}

function startHospitalReobserve(): void {
  const reobserver = new HospitalReobserver({
    send: (observations) => {
      sendActivities(observations, { kind: 'hospital' }, true);
    },
  });
  reobserver.start(document);
  window.addEventListener(
    'pagehide',
    () => {
      reobserver.stop();
    },
    { once: true },
  );
}

function startGraveDangerWait(): void {
  const waiter = new GraveDangerWaiter({
    send: (observations) => {
      sendActivities(observations, { kind: 'grave-danger' }, true);
    },
  });
  waiter.start(document);
  window.addEventListener(
    'pagehide',
    () => {
      waiter.stop();
    },
    { once: true },
  );
}

function armExpelliboxLeaveAssumption(): void {
  let sent = false;

  const fire = (): void => {
    if (sent) return;
    sent = true;
    const leaveAt = Date.now();
    sendActivities([buildLeaveObservation(leaveAt)], { kind: 'expellibox' }, true);
  };

  window.addEventListener('pagehide', fire, { once: true });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') fire();
    },
    { once: true },
  );
}

/**
 * Poll local DOM until cooldown/playable, max window, or pagehide.
 * Does not call site APIs or inject network.
 */
function startExpelliboxPolling(): void {
  let finished = false;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  const startedAt = Date.now();

  const stop = (): void => {
    finished = true;
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  const tick = (phase: 'polling' | 'final'): void => {
    if (finished && phase === 'polling') return;

    try {
      const observedAt = Date.now();
      const result = parseExpellibox(document, observedAt);

      // Quiet while empty; log only on terminal unknown or first cooldown/playable
      if (result.isCooldown || result.isPlayableVisit) {
        for (const d of result.diagnostics) {
          console.info('[neopets-reminders]', 'expellibox', d);
        }
      } else if (phase === 'final') {
        for (const d of result.diagnostics) {
          console.info('[neopets-reminders]', 'expellibox', `${d} (final)`);
        }
      }

      const action = decideExpelliboxAction(result, phase);

      switch (action.type) {
        case 'send':
          stop();
          sendActivities(
            action.observations,
            { kind: 'expellibox' },
            action.replaceScope,
          );
          return;
        case 'arm-leave':
          stop();
          armExpelliboxLeaveAssumption();
          return;
        case 'continue-polling':
          if (Date.now() - startedAt >= EXPELLIBOX_POLL_MAX_MS) {
            tick('final');
          }
          return;
        case 'stop':
          stop();
          return;
      }
    } catch (err) {
      console.info(
        '[neopets-reminders]',
        'expellibox-poll-failed-safe',
        String(err),
      );
      stop();
    }
  };

  // Stop polling when the user leaves; do not force-unknown on leave if still empty
  window.addEventListener(
    'pagehide',
    () => {
      stop();
    },
    { once: true },
  );

  console.info(
    '[neopets-reminders]',
    'expellibox',
    `poll local DOM every ${EXPELLIBOX_POLL_MS}ms (max ${EXPELLIBOX_POLL_MAX_MS}ms)`,
  );

  tick('polling');
  if (!finished) {
    intervalId = setInterval(() => tick('polling'), EXPELLIBOX_POLL_MS);
  }
}

function run(): void {
  const page = classifyPageUrl(location.href);
  if (!page) return;

  const observedAt = Date.now();

  try {
    if (page.kind === 'training') {
      const { activityObservations, diagnostics } = parseTraining(
        document,
        page.school,
        observedAt,
      );
      for (const d of diagnostics) {
        console.info('[neopets-reminders]', d.school, d.reason);
      }
      sendActivities(
        activityObservations.filter((o) => o.activityStatus !== 'unsupported'),
        { kind: 'training', school: page.school },
        true,
      );
      const unsupported = activityObservations.filter(
        (o) => o.activityStatus === 'unsupported',
      );
      if (unsupported.length) {
        sendActivities(
          unsupported,
          { kind: 'training', school: page.school },
          false,
        );
      }
      return;
    }

    if (page.kind === 'hospital') {
      startHospitalReobserve();
      return;
    }

    if (page.kind === 'grave-danger') {
      startGraveDangerWait();
      return;
    }

    if (page.kind === 'healing-springs') {
      const { observations, diagnostics } = parseHealingSprings(
        document,
        observedAt,
      );
      for (const d of diagnostics)
        console.info('[neopets-reminders]', 'healing-springs', d);
      sendActivities(observations, { kind: 'healing-springs' }, true);
      return;
    }

    if (page.kind === 'coltzan') {
      const { observations, diagnostics } = parseColtzan(document, observedAt);
      for (const d of diagnostics)
        console.info('[neopets-reminders]', 'coltzan', d);
      sendActivities(observations, { kind: 'coltzan' }, true);
      return;
    }

    if (page.kind === 'meteor') {
      const { observations, diagnostics } = parseMeteor(document, observedAt);
      for (const d of diagnostics)
        console.info('[neopets-reminders]', 'meteor', d);
      sendActivities(observations, { kind: 'meteor' }, true);
      return;
    }

    if (page.kind === 'expellibox') {
      startExpelliboxPolling();
    }
  } catch (err) {
    console.info('[neopets-reminders]', 'observe-failed-safe', String(err));
  }
}

run();
