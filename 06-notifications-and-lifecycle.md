# Notifications, Chrome Lifecycle, and Reliability

## 1. Use `chrome.alarms`, not `setTimeout`

Manifest V3 uses an event-driven service worker. It is not a permanent background page. Long JavaScript timeouts are therefore the wrong primitive for multi-minute/hour Neopets timers.

Chrome's `alarms` API is specifically designed to schedule work at a future time.

Official docs:  
https://developer.chrome.com/docs/extensions/reference/api/alarms

## 2. Source of truth

Always:

```text
storage record first → alarm second
```

Never:

```text
alarm only → hope it survives
```

Chrome 150+ exposes `persistAcrossSessions`, but Chrome's documentation still recommends that important dynamic alarms be represented elsewhere and recreated if missing, especially for older Chrome/other browsers.

## 3. Service-worker initialization

At top-level worker startup:

```text
await reconcileReminders()
```

Also register:

```text
chrome.runtime.onInstalled
chrome.runtime.onStartup
chrome.alarms.onAlarm
chrome.notifications.onClicked
```

Keep handlers short and idempotent.

## 4. Device sleep

Chrome documents that alarms do not wake a sleeping device. Missed alarms fire when the device wakes.

Desired behavior after wake:

1. alarm handler or reconciliation sees `dueAt <= now`;
2. reminder becomes Ready;
3. create at most one notification according to dedupe policy;
4. popup shows `Ready now`.

Do not attempt to install a native daemon in V1.

## 5. Browser quit / restart

When Chrome is not running, an extension cannot actively post a Chrome notification.

On restart:

- storage still contains deadlines;
- reconciliation marks expired reminders ready;
- if appropriate, show a “ready while Chrome was closed” notification once.

Do not promise always-on OS reminders after a complete Chrome quit.

## 6. Notifications API

Official guide:  
https://developer.chrome.com/docs/extensions/develop/ui/notify-users

Manifest permission:

```json
"permissions": ["notifications"]
```

A basic notification should contain only:

- activity;
- pet/petpet label if applicable;
- ready time/state;
- optional passive “Open” behavior through notification click.

## 7. macOS behavior

Chrome notifications ultimately depend on both browser/extension behavior and OS notification permissions. V1 onboarding should include a “Test notification” button in the extension UI so the user can verify macOS/Chrome permissions without waiting hours for a Neopets timer.

The test notification is purely local and does not touch Neopets.

## 8. Notification deduplication

Recommended fields:

```text
notifiedAt
notificationGeneration
```

Rules:

- one completion notification per observed timer generation;
- revisiting the page and observing a new future deadline creates a new generation;
- restarting Chrome must not emit the same notification repeatedly;
- user may manually dismiss/remove a reminder.

## 9. Early notifications

Optional later feature:

```text
notify 5 / 10 / 15 minutes before
```

This remains safe if it is entirely derived from an already stored local deadline. Do not use it to trigger a page refresh.
