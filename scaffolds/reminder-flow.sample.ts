// Illustrative architecture only; adapt to the project's actual module structure.
// This file intentionally contains no Neopets network request or gameplay action.

const ALARM_PREFIX = 'neo-reminder:';

async function saveThenSchedule(reminder: ReminderRecord) {
  const state = await loadReminderState();
  state[reminder.id] = reminder;
  await chrome.storage.local.set({ reminders: state });

  if (reminder.status === 'scheduled' && reminder.dueAt > Date.now()) {
    await chrome.alarms.create(ALARM_PREFIX + reminder.id, {
      when: reminder.dueAt
      // Do not rely exclusively on alarm persistence; storage remains authoritative.
    });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const reminderId = alarm.name.slice(ALARM_PREFIX.length);
  const reminder = await loadReminder(reminderId);
  if (!reminder) return;

  reminder.status = 'ready';
  await persistReminder(reminder);

  if (!reminder.notifiedAt) {
    await chrome.notifications.create(reminder.id, {
      type: 'basic',
      iconUrl: 'icons/128.png',
      title: notificationTitle(reminder),
      message: notificationMessage(reminder)
    });

    reminder.notifiedAt = Date.now();
    await persistReminder(reminder);
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const reminder = await loadReminder(notificationId);
  if (!reminder) return;

  const url = canonicalAllowedUrl(reminder);
  if (!url) return;

  // User explicitly clicked the notification. Navigation only; no gameplay action.
  await chrome.tabs.create({ url });
});

// Placeholder declarations for illustration.
declare interface ReminderRecord {
  id: string;
  kind: string;
  sourceUrl: string;
  dueAt: number;
  status: 'scheduled' | 'ready' | 'dismissed';
  notifiedAt?: number;
}
declare function loadReminderState(): Promise<Record<string, ReminderRecord>>;
declare function loadReminder(id: string): Promise<ReminderRecord | undefined>;
declare function persistReminder(r: ReminderRecord): Promise<void>;
declare function notificationTitle(r: ReminderRecord): string;
declare function notificationMessage(r: ReminderRecord): string;
declare function canonicalAllowedUrl(r: ReminderRecord): string | null;
