import {
  notificationIdFor,
  parseNotificationId,
} from '../shared/generation.js';
import {
  KIND_LABELS,
  SCHOOL_LABELS,
  TEST_NOTIFICATION_ID,
  type ReminderRecord,
} from '../shared/types.js';
import { canonicalUrlForKind } from '../shared/url-allowlist.js';
import type { ReminderStore } from './reminder-store.js';

export interface NotificationsApi {
  create(
    notificationId: string,
    options: {
      type: 'basic';
      iconUrl: string;
      title: string;
      message: string;
      priority?: number;
      requireInteraction?: boolean;
      silent?: boolean;
    },
  ): Promise<string>;
  clear(notificationId: string): Promise<boolean>;
  getPermissionLevel?: () => Promise<'granted' | 'denied'>;
}

export interface TabsApi {
  create(createProperties: { url: string }): Promise<unknown>;
}

function notificationIconUrl(): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('assets/icon-128.png');
    }
  } catch {
    // tests / non-chrome
  }
  return 'assets/icon-128.png';
}

const ALLOWED_OPEN_PREFIXES = [
  'https://www.neopets.com/pirates/academy.phtml',
  'https://www.neopets.com/island/training.phtml',
  'https://www.neopets.com/island/fight_training.phtml',
  'https://www.neopets.com/hospital/volunteer.phtml',
  'https://www.neopets.com/halloween/gravedanger',
  'https://www.neopets.com/faerieland/springs.phtml',
  'https://www.neopets.com/desert/shrine.phtml',
  'https://ncmall.neopets.com/mall/shop.phtml?page=giveaway',
  'https://www.neopets.com/moon/meteor.phtml',
];

export function isAllowedOpenUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'www.neopets.com' && u.hostname !== 'ncmall.neopets.com') {
      return false;
    }
    return ALLOWED_OPEN_PREFIXES.some((p) => {
      if (url === p) return true;
      if (url.startsWith(p + '&') || url.startsWith(p + '#')) return true;
      // path-only prefixes (no query in prefix)
      if (!p.includes('?') && (url.startsWith(p + '?') || url.startsWith(p + '/'))) {
        return true;
      }
      return false;
    });
  } catch {
    return false;
  }
}

export function completionTitle(record: ReminderRecord): string {
  return `${KIND_LABELS[record.kind]} ready`;
}

export function completionMessage(record: ReminderRecord): string {
  if (record.kind === 'training' && record.school) {
    return `${record.subject} is ready at ${SCHOOL_LABELS[record.school]}.`;
  }
  if (record.contextLabel) {
    return `${record.subject} · ${record.contextLabel} may be ready (local estimate).`;
  }
  return `${record.subject} may be ready (local estimate).`;
}

export async function maybeNotifyCompletion(
  store: ReminderStore,
  notifications: NotificationsApi,
  recordId: string,
  now: number,
): Promise<{ notified: boolean; reason?: string }> {
  let notified = false;
  let reason: string | undefined;

  await store.mutate(async (state) => {
    const record = state.reminders[recordId];
    if (!record) {
      reason = 'missing';
      return;
    }

    if (!state.settings.trainingEnabled) {
      reason = 'training-disabled';
      return;
    }
    if (!state.settings.notificationsEnabled) {
      reason = 'notifications-disabled';
      return;
    }

    if (record.notifiedGeneration === record.generation) {
      reason = 'already-notified';
      return;
    }

    // Do not notify pure available/unsupported UI rows
    if (
      record.activityStatus === 'available' ||
      record.activityStatus === 'unsupported' ||
      record.activityStatus === 'unknown'
    ) {
      reason = 'not-notifiable-status';
      return;
    }

    if (record.status !== 'ready') {
      state.reminders[recordId] = { ...record, status: 'ready' };
    }

    const current = state.reminders[recordId]!;
    const id = notificationIdFor(current);

    try {
      await notifications.create(id, {
        type: 'basic',
        iconUrl: notificationIconUrl(),
        title: completionTitle(current),
        message: completionMessage(current),
        priority: 2,
      });
      state.reminders[recordId] = {
        ...current,
        status: 'ready',
        activityStatus:
          current.activityStatus === 'active'
            ? 'ready'
            : current.activityStatus,
        notifiedGeneration: current.generation,
        lastNotificationAt: now,
      };
      notified = true;
    } catch (err) {
      reason = 'notification-api-failed';
      console.warn('[neopets-reminders] notification create failed', err);
      state.reminders[recordId] = {
        ...current,
        status: 'ready',
      };
    }
  });

  if (notified) return { notified: true };
  return reason !== undefined
    ? { notified: false, reason }
    : { notified: false };
}

export async function showTestNotification(
  notifications: NotificationsApi,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (notifications.getPermissionLevel) {
      const level = await notifications.getPermissionLevel();
      if (level === 'denied') {
        return {
          ok: false,
          error:
            'Browser notification permission is denied. Enable notifications for Chrome in macOS System Settings → Notifications, and for this extension on chrome://extensions.',
        };
      }
    }

    // Replace any prior test notification so macOS/Chrome will show it again
    await notifications.clear(TEST_NOTIFICATION_ID);

    await notifications.create(TEST_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: notificationIconUrl(),
      title: 'Visit Reminders',
      message:
        'Test notification (local only). No Neopets page was opened or requested.',
      priority: 2,
      requireInteraction: false,
      silent: false,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Notification failed';
    return {
      ok: false,
      error: `${message} — Also check macOS System Settings → Notifications → Google Chrome is allowed.`,
    };
  }
}

export async function handleNotificationClick(
  store: ReminderStore,
  tabs: TabsApi,
  notificationId: string,
  notifications: NotificationsApi,
): Promise<void> {
  if (notificationId === TEST_NOTIFICATION_ID) {
    await notifications.clear(notificationId);
    return;
  }

  const parsed = parseNotificationId(notificationId);
  if (!parsed) return;

  const record = await store.getReminder(parsed.reminderId);
  if (!record) {
    await notifications.clear(notificationId);
    return;
  }

  const url = canonicalUrlForKind(record.kind, record.school);
  if (isAllowedOpenUrl(url)) {
    await tabs.create({ url });
  }
  await notifications.clear(notificationId);
}

export async function openReminderTab(
  store: ReminderStore,
  tabs: TabsApi,
  reminderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const record = await store.getReminder(reminderId);
  if (!record) return { ok: false, error: 'Reminder not found' };
  const url = canonicalUrlForKind(record.kind, record.school);
  if (!isAllowedOpenUrl(url)) return { ok: false, error: 'URL not allowed' };
  await tabs.create({ url });
  return { ok: true };
}

export async function openAllowedUrl(
  tabs: TabsApi,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isAllowedOpenUrl(url)) return { ok: false, error: 'URL not allowed' };
  await tabs.create({ url });
  return { ok: true };
}

export function chromeNotificationsApi(): NotificationsApi {
  return {
    create: (id, options) =>
      new Promise((resolve, reject) => {
        chrome.notifications.create(id, options, (createdId) => {
          const err = chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else resolve(createdId || id);
        });
      }),
    clear: (id) =>
      new Promise((resolve) => {
        chrome.notifications.clear(id, (wasCleared) => {
          resolve(Boolean(wasCleared));
        });
      }),
    getPermissionLevel: () =>
      new Promise((resolve) => {
        if (!chrome.notifications.getPermissionLevel) {
          resolve('granted');
          return;
        }
        chrome.notifications.getPermissionLevel((level) => {
          resolve(level === 'denied' ? 'denied' : 'granted');
        });
      }),
  };
}

export function chromeTabsApi(): TabsApi {
  return {
    create: (props) => chrome.tabs.create(props),
  };
}
