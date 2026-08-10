# Chrome MV3 Architecture

## 1. Components

### A. Narrow content scripts

One parser entry point per activity family:

```text
src/content/training.ts
src/content/grave-danger.ts
src/content/neolodge.ts        # P1
src/content/kadoatery.ts       # P1/manual input may live in popup instead
```

Responsibilities:

- verify the current page is the expected supported surface;
- read rendered DOM;
- call a pure parser;
- emit `ReminderObservation[]` to the service worker.

No timers should live in content scripts. No network requests should originate from them.

### B. Pure parsers

```text
src/parsers/training.ts
src/parsers/grave-danger.ts
src/parsers/neolodge.ts
```

Input: an HTML/DOM abstraction or extracted text.  
Output: structured observations with no side effects.

This makes the highest-risk site-dependent logic testable against saved local fixtures.

### C. Service worker

```text
src/background/service-worker.ts
src/background/reminders.ts
src/background/notifications.ts
```

Responsibilities:

- validate messages from content scripts;
- merge/upsert reminders;
- persist state;
- create/clear alarms;
- reconcile alarms on worker startup/install/browser startup;
- create notifications;
- handle explicit notification clicks.

### D. Popup

```text
src/popup/
```

Displays:

- Ready now
- Upcoming reminders sorted by due time
- Last observed time / stale marker
- Enable/disable per reminder type
- Remove reminder
- Open activity button

Do not add “Do it now” actions that submit gameplay forms.

## 2. Data model

Recommended TypeScript model:

```ts
export type ReminderKind =
  | 'training'
  | 'grave-danger'
  | 'neolodge'
  | 'kadoatery';

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  subject: string;          // pet/petpet or human-readable activity label
  sourceUrl: string;
  observedAt: number;       // epoch ms
  dueAt: number;            // epoch ms
  status: 'scheduled' | 'ready' | 'dismissed';
  parserVersion: number;
  sourceDetail?: string;    // school, display label, etc.
  notifiedAt?: number;
}
```

ID examples:

```text
training:mystery:PetName
grave-danger:PetName:PetpetName
neolodge:PetName
kadoatery:window
```

IDs must be stable so revisiting a page updates rather than duplicates the same logical reminder.

## 3. Storage is the source of truth

Use:

```text
chrome.storage.local
```

Recommended keys:

```text
schemaVersion
reminders
settings
migrationState
```

Never keep authoritative deadlines only in globals or `setTimeout`.

## 4. Alarm model

For each scheduled reminder:

```text
alarm name = neo-reminder:<reminder.id>
when       = reminder.dueAt
```

`chrome.alarms` fires approximately, not as a real-time scheduler. Seconds-level precision is unnecessary for Neopets return reminders.

### Reconciliation algorithm

Run at service-worker module startup and from `runtime.onInstalled` / `runtime.onStartup`:

1. Load reminders from storage.
2. Read current alarms.
3. For every future scheduled reminder, ensure exactly one alarm exists with a matching deadline.
4. For every reminder whose `dueAt <= now`, mark `ready`.
5. Remove orphaned extension alarms.
6. Avoid duplicate notifications using `notifiedAt` / notification policy.

This design remains robust even when alarms were cleared or the browser restarted.

Chrome 150 added explicit `persistAcrossSessions`, but compatibility should not depend on it. The official alarms documentation itself recommends persisting dynamic alarm state elsewhere and recreating missing alarms.

Official docs: https://developer.chrome.com/docs/extensions/reference/api/alarms

## 5. Notification model

Use `chrome.notifications` with the `notifications` permission.

Example product behavior:

```text
Title: Training complete
Body: MyPet is ready at Mystery Island Training School.
Click: Open training status page
```

The notification is informational. It must not have a button that performs a gameplay action.

On notification click:

1. look up the reminder by notification/reminder id;
2. validate the stored URL belongs to an allowlisted Neopets path;
3. call `chrome.tabs.create({ url })`;
4. do nothing else.

Official notification guide: https://developer.chrome.com/docs/extensions/develop/ui/notify-users

## 6. URL allowlist

Do not open arbitrary URLs stored from page content. Map reminder kinds to controlled URL patterns.

Examples:

```text
https://www.neopets.com/pirates/academy.phtml?type=status
https://www.neopets.com/island/training.phtml?type=status
https://www.neopets.com/island/fight_training.phtml?type=status
https://www.neopets.com/halloween/gravedanger/index.phtml
```

The content script may record which known school was observed, and the service worker should derive the canonical link from that enum rather than trust arbitrary DOM href data.

## 7. Manifest philosophy

Use Manifest V3 and an extension service worker. MV3 background logic is event driven; it is not a permanent background page.

Official docs:

- https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics

### Permissions

Required:

```text
storage
alarms
notifications
```

Avoid unless a concrete later requirement proves necessary:

```text
cookies
webRequest
declarativeNetRequest
history
downloads
```

## 8. No backend

V1 should have:

- no account system;
- no telemetry by default;
- no cloud synchronization;
- no server-side timer queue;
- no remote configuration controlling parsing behavior.

MV3 also disallows remotely hosted executable code; bundle all parsers with the extension.

## 9. Suggested repository layout

```text
neopets-reminders/
  manifest.json
  package.json
  tsconfig.json
  src/
    background/
      service-worker.ts
      reminder-store.ts
      alarm-reconciler.ts
      notifications.ts
    content/
      training.ts
      grave-danger.ts
    parsers/
      training.ts
      grave-danger.ts
      duration.ts
    shared/
      messages.ts
      types.ts
      url-allowlist.ts
    popup/
      index.html
      popup.ts
      popup.css
  tests/
    fixtures/
      training/
      grave-danger/
    parsers/
    integration/
  scripts/
    safety-audit.mjs
```
