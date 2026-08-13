import { alarmNameFor, notificationIdFor } from '../shared/generation.js';
import { ALARM_PREFIX, type ReminderRecord, type StoredStateV1 } from '../shared/types.js';
import type { ReminderStore } from './reminder-store.js';

export interface AlarmInfo {
  name: string;
  scheduledTime?: number;
}

export interface AlarmsApi {
  getAll(): Promise<AlarmInfo[]>;
  create(name: string, info: { when: number }): Promise<void>;
  clear(name: string): Promise<boolean>;
}

export interface NotificationClearApi {
  clear(notificationId: string): Promise<boolean>;
}

export interface ReconcileOptions {
  now: number;
  /** Called when a past-due scheduled reminder becomes ready and may notify. */
  onBecameReady?: (record: ReminderRecord) => Promise<void>;
}

const DEADLINE_SKEW_MS = 30_000;

/**
 * Storage-first alarm reconciliation.
 * Never calls chrome.alarms.clearAll().
 * Only clears orphan alarms with this extension's prefix.
 */
export async function reconcileAlarms(
  store: ReminderStore,
  alarms: AlarmsApi,
  notifications: NotificationClearApi,
  options: ReconcileOptions,
): Promise<StoredStateV1> {
  const { now, onBecameReady } = options;

  const becameReadyIds: string[] = [];

  const state = await store.mutate(async (s) => {
    for (const id of Object.keys(s.reminders)) {
      const r = s.reminders[id];
      if (!r) continue;
      // Only transition previously scheduled deadlines — never treat
      // page-observed "already ready" as a completion notification trigger.
      if (r.status === 'scheduled' && r.dueAt <= now) {
        s.reminders[id] = { ...r, status: 'ready' };
        becameReadyIds.push(id);
      }
    }
  });

  if (onBecameReady) {
    for (const id of becameReadyIds) {
      const r = state.reminders[id];
      if (!r) continue;
      if (r.notifiedGeneration === r.generation) continue;
      if (!state.settings.trainingEnabled) continue;
      if (!state.settings.notificationsEnabled) continue;
      await onBecameReady(r);
    }
  }

  // Re-read after possible notification metadata updates
  const latest = await store.read();
  await syncAlarmsToState(latest, alarms, notifications, now);
  return latest;
}

export async function syncAlarmsToState(
  state: StoredStateV1,
  alarms: AlarmsApi,
  _notifications: NotificationClearApi,
  now: number,
): Promise<void> {
  const existing = await alarms.getAll();
  const ourAlarms = existing.filter((a) => a.name.startsWith(ALARM_PREFIX));
  const desired = new Map<string, ReminderRecord>();

  if (state.settings.trainingEnabled) {
    for (const r of Object.values(state.reminders)) {
      if (r.status === 'scheduled' && r.dueAt > now) {
        desired.set(alarmNameFor(r), r);
      }
    }
  }

  // Clear orphans and wrong-generation / wrong-deadline alarms
  for (const alarm of ourAlarms) {
    const wanted = desired.get(alarm.name);
    if (!wanted) {
      await alarms.clear(alarm.name);
      continue;
    }
    const scheduled = alarm.scheduledTime;
    if (
      scheduled !== undefined &&
      Math.abs(scheduled - wanted.dueAt) > DEADLINE_SKEW_MS
    ) {
      await alarms.clear(alarm.name);
      // will recreate below
      continue;
    }
    // Keep matching alarm
    desired.delete(alarm.name);
  }

  // Create missing
  for (const [name, record] of desired) {
    await alarms.create(name, { when: record.dueAt });
  }
}

export async function clearAlarmForRecord(
  alarms: AlarmsApi,
  record: ReminderRecord,
): Promise<void> {
  await alarms.clear(alarmNameFor(record));
}

export async function clearNotificationForRecord(
  notifications: NotificationClearApi,
  record: ReminderRecord,
): Promise<void> {
  await notifications.clear(notificationIdFor(record));
}

/** After disable: clear all training alarms, keep records. */
export async function clearAllTrainingAlarms(
  alarms: AlarmsApi,
): Promise<void> {
  const all = await alarms.getAll();
  for (const a of all) {
    if (a.name.startsWith(ALARM_PREFIX)) {
      await alarms.clear(a.name);
    }
  }
}

export function chromeAlarmsApi(): AlarmsApi {
  return {
    getAll: () => chrome.alarms.getAll(),
    create: async (name, info) => {
      await chrome.alarms.create(name, info);
    },
    clear: (name) =>
      new Promise<boolean>((resolve) => {
        chrome.alarms.clear(name, (wasCleared) => {
          resolve(Boolean(wasCleared));
        });
      }),
  };
}

export function chromeNotificationClearApi(): NotificationClearApi {
  return {
    clear: (id) =>
      new Promise<boolean>((resolve) => {
        chrome.notifications.clear(id, (wasCleared) => {
          resolve(Boolean(wasCleared));
        });
      }),
  };
}
