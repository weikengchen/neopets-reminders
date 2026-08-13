/**
 * MV3 service worker entry.
 * Observe, never act: no Neopets network requests; navigation only via
 * explicit popup/notification click through chrome.tabs.create.
 */
import {
  applyActivityObservation,
  applyObservation,
  parseAlarmName,
} from '../shared/generation.js';
import {
  isContentMessage,
  isPopupRequest,
  SUPPORT_MATRIX,
  type PopupResponse,
} from '../shared/messages.js';
import {
  observationId,
  staleIdsAfterScan,
} from '../shared/scope-reconcile.js';
import {
  buildTrainingReminderId,
  validateActivityMessage,
  validateContentMessage,
} from '../shared/validation.js';
import {
  chromeAlarmsApi,
  chromeNotificationClearApi,
  clearAlarmForRecord,
  clearAllTrainingAlarms,
  clearNotificationForRecord,
  reconcileAlarms,
  syncAlarmsToState,
} from './alarm-reconciler.js';
import {
  chromeNotificationsApi,
  chromeTabsApi,
  handleNotificationClick,
  maybeNotifyCompletion,
  openAllowedUrl,
  openReminderTab,
  showTestNotification,
} from './notifications.js';
import { chromeStorageAdapter, ReminderStore } from './reminder-store.js';

const store = new ReminderStore(chromeStorageAdapter());
const alarmsApi = chromeAlarmsApi();
const notificationClearApi = chromeNotificationClearApi();
const notificationsApi = chromeNotificationsApi();
const tabsApi = chromeTabsApi();

function now(): number {
  return Date.now();
}

/** Drop legacy per-shift hospital "available" noise from earlier builds. */
async function purgeHospitalAvailableNoise(): Promise<void> {
  try {
    await store.mutate((state) => {
      for (const id of Object.keys(state.reminders)) {
        const r = state.reminders[id];
        if (!r) continue;
        if (
          r.kind === 'hospital' &&
          r.activityStatus === 'available' &&
          r.timerQuality === 'none'
        ) {
          delete state.reminders[id];
        }
      }
    });
  } catch (err) {
    console.warn('[neopets-reminders] available purge skipped', err);
  }
}

async function runReconcile(): Promise<void> {
  try {
    await purgeHospitalAvailableNoise();
    await reconcileAlarms(store, alarmsApi, notificationClearApi, {
      now: now(),
      onBecameReady: async (record) => {
        await maybeNotifyCompletion(store, notificationsApi, record.id, now());
      },
    });
  } catch (err) {
    console.error('[neopets-reminders] reconcile failed', err);
  }
}

async function upsertFromActivity(
  payload: NonNullable<ReturnType<typeof validateActivityMessage>>,
): Promise<void> {
  const { observations, replaceScope, scope } = payload;
  const keepIds = new Set(observations.map(observationId));

  for (const obs of observations) {
    const id = observationId(obs);
    const existing = await store.getReminder(id);
    const result = applyActivityObservation(existing, obs);
    if (result.action === 'skip') continue;
    const { record, previous } = result;
    if (previous && previous.generation !== record.generation) {
      await clearNotificationForRecord(notificationClearApi, previous);
      await clearAlarmForRecord(alarmsApi, previous);
    }
    await store.upsertReminder(record);
  }

  if (replaceScope) {
    const state = await store.read();
    const stale = staleIdsAfterScan(state.reminders, scope, keepIds);
    for (const id of stale) {
      const { removed } = await store.removeReminder(id);
      if (removed) {
        await clearAlarmForRecord(alarmsApi, removed);
        await clearNotificationForRecord(notificationClearApi, removed);
      }
    }
  }

  const latest = await store.read();
  await syncAlarmsToState(latest, alarmsApi, notificationClearApi, now());
}

async function handleContentMessage(
  message: unknown,
  senderUrl: string | undefined,
): Promise<void> {
  if (!message || typeof message !== 'object') return;
  const type = (message as { type?: string }).type;

  if (type === 'ACTIVITY_OBSERVED') {
    const payload = validateActivityMessage(message, senderUrl, now());
    if (!payload) {
      console.warn('[neopets-reminders] rejected ACTIVITY_OBSERVED');
      return;
    }
    await upsertFromActivity(payload);
    return;
  }

  if (type === 'TRAINING_OBSERVED') {
    const observations = validateContentMessage(message, senderUrl, now());
    if (!observations) {
      console.warn('[neopets-reminders] rejected TRAINING_OBSERVED');
      return;
    }
    for (const obs of observations) {
      const id = buildTrainingReminderId(obs.school, obs.petName);
      if (!id) continue;
      const existing = await store.getReminder(id);
      const result = applyObservation(existing, obs);
      if (result.action === 'skip') continue;
      const { record, previous } = result;
      if (previous && previous.generation !== record.generation) {
        await clearNotificationForRecord(notificationClearApi, previous);
        await clearAlarmForRecord(alarmsApi, previous);
      }
      await store.upsertReminder(record);
    }
    const state = await store.read();
    await syncAlarmsToState(state, alarmsApi, notificationClearApi, now());
  }
}

async function handlePopupMessage(message: unknown): Promise<PopupResponse> {
  if (!isPopupRequest(message)) {
    return { type: 'ERROR', message: 'Unknown message' };
  }

  try {
    switch (message.type) {
      case 'GET_STATE': {
        const state = await store.read();
        const reminders = Object.values(state.reminders).sort(
          (a, b) => a.dueAt - b.dueAt,
        );
        return {
          type: 'STATE',
          reminders,
          settings: state.settings,
          now: now(),
          support: SUPPORT_MATRIX,
        };
      }
      case 'REMOVE_REMINDER': {
        const { removed } = await store.removeReminder(message.id);
        if (removed) {
          await clearAlarmForRecord(alarmsApi, removed);
          await clearNotificationForRecord(notificationClearApi, removed);
        }
        return { type: 'OK' };
      }
      case 'OPEN_REMINDER': {
        const result = await openReminderTab(store, tabsApi, message.id);
        if (!result.ok) {
          return { type: 'ERROR', message: result.error ?? 'Open failed' };
        }
        return { type: 'OK' };
      }
      case 'OPEN_URL': {
        const result = await openAllowedUrl(tabsApi, message.url);
        if (!result.ok) {
          return { type: 'ERROR', message: result.error ?? 'Open failed' };
        }
        return { type: 'OK' };
      }
      case 'UPDATE_SETTINGS': {
        const prev = await store.getSettings();
        const state = await store.updateSettings(message.settings);

        if (prev.trainingEnabled && !state.settings.trainingEnabled) {
          await clearAllTrainingAlarms(alarmsApi);
        } else if (!prev.trainingEnabled && state.settings.trainingEnabled) {
          await store.mutate((s) => {
            const t = now();
            for (const id of Object.keys(s.reminders)) {
              const r = s.reminders[id];
              if (!r) continue;
              if (r.status === 'scheduled' && r.dueAt <= t) {
                s.reminders[id] = { ...r, status: 'ready' };
              }
            }
          });
          const latest = await store.read();
          await syncAlarmsToState(
            latest,
            alarmsApi,
            notificationClearApi,
            now(),
          );
        }
        return { type: 'OK' };
      }
      case 'TEST_NOTIFICATION': {
        const result = await showTestNotification(notificationsApi);
        if (!result.ok) {
          return {
            type: 'ERROR',
            message:
              result.error ??
              'Could not show test notification. Check OS/browser notification permission.',
          };
        }
        return { type: 'OK' };
      }
      default:
        return { type: 'ERROR', message: 'Unknown message' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[neopets-reminders] popup handler', err);
    return { type: 'ERROR', message: msg };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void runReconcile();
});

chrome.runtime.onStartup.addListener(() => {
  void runReconcile();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    const parsed = parseAlarmName(alarm.name);
    if (!parsed) return;

    const record = await store.getReminder(parsed.reminderId);
    if (!record) return;
    if (record.generation !== parsed.generation) return;

    const t = now();
    await store.mutate((state) => {
      const r = state.reminders[parsed.reminderId];
      if (!r) return;
      if (r.generation !== parsed.generation) return;
      state.reminders[parsed.reminderId] = {
        ...r,
        status: 'ready',
        activityStatus:
          r.activityStatus === 'active' || r.activityStatus === 'cooldown'
            ? 'ready'
            : r.activityStatus,
      };
    });

    await maybeNotifyCompletion(store, notificationsApi, parsed.reminderId, t);
  })();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  void handleNotificationClick(
    store,
    tabsApi,
    notificationId,
    notificationsApi,
  );
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isContentMessage(message)) {
    void handleContentMessage(message, sender.url).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (isPopupRequest(message)) {
    void handlePopupMessage(message).then((response) => {
      sendResponse(response);
    });
    return true;
  }

  return false;
});

void runReconcile();
