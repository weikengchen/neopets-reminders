# Phase 1 Engineering Plan — Training Reminder Vertical Slice

**Owner:** implementation agent (GPT-5.6 Luna)  
**Scope:** Chrome Manifest V3, Training timers only  
**Safety invariant:** observe rendered state after manual navigation; never request or act on Neopets automatically

## 1. Phase boundary

Phase 1 delivers one complete, auditable path for the three approved Training schools:

```text
human opens a supported status page
  -> content script parses rendered Training state
  -> service worker validates and stores a local reminder
  -> a local one-shot alarm becomes due
  -> one local notification is shown
  -> an explicit user click opens the canonical status page
```

Included:

- Swashbuckling Academy;
- Mystery Island Training School;
- Secret Ninja Training School;
- local reminder persistence and alarm reconciliation;
- completion notifications and notification test;
- popup Ready/Upcoming list, remove, enable/disable, and explicit Open;
- browserless automated tests plus unpacked-extension acceptance checks;
- automated safety and permission gates.

Excluded:

- Grave Danger (Phase 1.5/P0.5);
- Neolodge, Kadoatery, generic manual timers, early notifications, localization, sync, analytics, and a backend;
- MutationObserver-based continuous page watching unless a captured fixture/manual test proves that the supported page renders the timer after `document_idle`;
- all background Neopets requests, page refreshes, DOM actions, form submissions, and gameplay operations.

## 2. Locked implementation decisions

These defaults remove choices that should not block Luna:

| Area | Phase 1 decision |
| --- | --- |
| Repository | Treat this directory as the project root. Initialize local Git if it is still absent; do not create a remote, push, publish, or deploy. Preserve every planning document and scaffold. |
| Tooling | npm with a committed `package-lock.json`; TypeScript in strict mode; a small esbuild build script; Vitest; ESLint; vanilla TypeScript/HTML/CSS popup. No React/Preact and no runtime third-party dependency. |
| Browser | Chrome MV3, practical baseline Chrome 120+. Do not depend on Chrome 150 `persistAcrossSessions`; storage-backed reconciliation remains mandatory. |
| UI language | English only for Phase 1. Use browser-local time formatting. Store all times as epoch milliseconds. |
| Storage | `chrome.storage.local` only. One schema-v1 state object, no sync, credentials, cookies, history, or remote logging. |
| Identity | A Training reminder ID is `training:<school>:<normalized pet name>`. Preserve the trimmed name for display; for the ID apply NFKC normalization, lower-case in a fixed English locale, then `encodeURIComponent`, with a defensive 64-character input cap. No account identifier is collected. |
| Removal | Remove deletes the record, its alarm, and any visible notification. Do not implement a second dormant `dismissed` state in Phase 1. |
| Page absence | Never delete reminders merely because a selector returns no rows. Only update positive, validated observations; the user can remove a stale record. A future fixture-backed explicit “not training” state may add safe resolution behavior. |
| Navigation | Store/derive a canonical URL from the `TrainingSchool` enum. Never trust a URL supplied by page DOM or content-script payload. Open only after popup or notification click. |
| Notifications | Global notifications and Training reminders default on. Turning either off prevents future completion notifications without deleting records. Re-enabling does not emit retroactive notifications for already-ready records. The explicit Test Notification button may still attempt a local test. |
| Countdown precision | Display friendly minute-level countdowns; show `Ready now` when `dueAt <= now`. Alarm delivery is approximate and must not be represented as second-perfect. |

## 3. Required fixture gate

Production Training selectors must be derived from current, manually captured, sanitized fixtures. Old userscript selectors are research hints only.

Required files:

```text
tests/fixtures/training/
  pirate-active.html
  pirate-ready.html
  mystery-active.html
  mystery-ready.html
  ninja-active.html
  ninja-ready.html
  multiple-pets.html             # only if a current page can show multiple rows
  malformed.html
  README.md
```

`README.md` records capture date, exact page family, represented state, and what personal/account data was removed. Preserve pet-name/timer structure using obviously synthetic replacements. Do not include cookies, tokens, account name, balances, inventory, full page dumps, or unrelated navigation/account HTML.

The six active/ready fixtures are a hard gate for completing the production parser. If they are unavailable, Luna may finish WP0, WP1, and the storage/alarm/notification domain modules from WP4-WP5 against synthetic observations. WP2, WP3, popup integration, and WP7 end-to-end acceptance remain blocked. It must not fabricate selectors or copy historical selectors and call them current.

## 4. Target repository shape

```text
manifest.json
package.json
package-lock.json
tsconfig.json
eslint.config.js
scripts/
  build.mjs
  safety-audit.mjs
src/
  background/
    service-worker.ts
    reminder-store.ts
    alarm-reconciler.ts
    notifications.ts
  content/
    training.ts
  parsers/
    duration.ts
    training.ts
  popup/
    index.html
    popup.ts
    popup.css
  shared/
    messages.ts
    types.ts
    url-allowlist.ts
    validation.ts
  assets/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
tests/
  fixtures/training/
  unit/
  integration/
  helpers/
dist/                           # generated, not hand-edited
```

Use a neutral original placeholder icon; do not copy Neopets art. The build must clean and reproduce `dist/` from tracked source/assets. Whether `dist/` is committed can be decided at release time; Phase 1 acceptance only requires a reproducible local build.

## 5. Domain contracts

### 5.1 Stored schema

Implement schema version 1 explicitly:

```ts
type TrainingSchool = 'pirate' | 'mystery' | 'ninja';

interface ReminderRecord {
  id: string;
  kind: 'training';
  subject: string;
  school: TrainingSchool;
  observedAt: number;
  dueAt: number;
  status: 'scheduled' | 'ready';
  parserVersion: 1;
  generation: number;
  notifiedGeneration?: number;
  lastNotificationAt?: number;
}

interface Settings {
  trainingEnabled: boolean;
  notificationsEnabled: boolean;
}

interface StoredStateV1 {
  schemaVersion: 1;
  reminders: Record<string, ReminderRecord>;
  settings: Settings;
}
```

Storage readers must validate unknown data and merge safe defaults. If a stored schema version is newer than supported, fail visibly in the extension console and do not overwrite it. Register Chrome event listeners synchronously at service-worker module scope; start asynchronous reconciliation only after listeners are registered.

Serialize worker state mutations through one in-memory promise queue so message, alarm, and popup events cannot perform overlapping read-modify-write cycles during one worker lifetime.

### 5.2 Observation/message schema

The content script derives school from the current URL, parses the current document, and sends only structured data:

```ts
interface TrainingObservation {
  kind: 'training';
  petName: string;
  school: TrainingSchool;
  observedAt: number;
  dueAt: number;
  state: 'training' | 'ready';
  parserVersion: 1;
}

type ContentMessage = {
  type: 'TRAINING_OBSERVED';
  observations: TrainingObservation[];
};
```

The service worker revalidates every field: known message type, array size cap, exact kind/school, trimmed valid pet name, finite safe timestamps, bounded duration, parser version, and `sender.url` on the matching allowlisted Training status URL. Reject the whole message if its school conflicts with the sender URL. Never accept `sourceUrl` from the message.

Use a conservative maximum future duration (for example 30 days) to reject corrupt or malicious timestamps without trying to encode every possible Training rule.

### 5.3 URL rules

Manifest matches may cover each `.phtml*` path, but runtime admission requires HTTPS, host `www.neopets.com`, the exact pathname, and query parameter `type=status`:

```text
pirate  -> /pirates/academy.phtml?type=status
mystery -> /island/training.phtml?type=status
ninja   -> /island/fight_training.phtml?type=status
```

Popup/notification Open always reconstructs one of these canonical URLs from `school`.

### 5.4 Generation and notification deduplication

- New ID: `generation = 1`.
- Existing scheduled reminder with a newly observed future `dueAt` within 60 seconds: same generation; update observation/deadline without clearing notification metadata.
- Existing reminder followed by a materially different future deadline, or ready followed by future Training: increment generation and clear notification metadata.
- An observed ready state for an existing scheduled record keeps the generation and marks it ready.
- Alarm and notification IDs include reminder ID and generation.
- Creating the same stable notification ID again must replace the existing system notification, not create a storm.
- Write the ready state, create/replace the stable notification if allowed, then persist `notifiedGeneration`. A retry between those steps remains idempotent because the notification ID is stable.
- Reconciliation may notify once when a previously scheduled reminder became overdue while Chrome was closed or the device slept, provided both settings are enabled. It must not notify merely because settings were re-enabled after the deadline.
- Starting a new generation clears any still-visible notification from the previous generation.

Do not notify immediately just because a manually opened page already says `Course Finished!`; store/show Ready. Notifications are for transitions caused by a saved future deadline. This prevents surprise notifications during page observation and on first install.

## 6. Work packages

### WP0 — Bootstrap and guardrails

Deliverables:

- initialize local Git if absent and record the starting untracked planning pack before feature work;
- create npm/TypeScript/esbuild/Vitest/ESLint configuration and lockfile;
- add scripts: `build`, `typecheck`, `lint`, `test`, `safety:audit`, and aggregate `check`;
- create MV3 manifest with exactly `storage`, `alarms`, `notifications` and only the three Training content-script matches;
- add a basic popup shell, service worker entry, neutral local icons, `.gitignore`, and `SECURITY_AND_FAIR_PLAY.md` adapted from `01-policy-safety.md`;
- implement the safety audit before content behavior.

Safety audit minimum:

- fail on `fetch`, XHR, WebSocket, EventSource, `location.reload`, form submission/requestSubmit, content-script DOM `.click()`, remote script URLs, forbidden manifest permissions, `<all_urls>`, and unexpected hosts in production source/bundle;
- allow explicit `chrome.tabs.create` only in the reviewed service-worker navigation handler;
- scan source and built output, while excluding planning documents and tests from production-source string checks.

Exit evidence:

- clean `npm run check`;
- reproducible `dist/`;
- unpacked extension loads, popup opens, worker has no startup errors;
- manifest permission/host diff shown in the handoff.

### WP1 — Shared contracts and pure domain functions

Deliverables:

- schema-v1 types/defaults and runtime validators;
- exact Training URL classifier/canonical URL map;
- stable ID normalization;
- duration parser returning milliseconds or `null`;
- pure functions for observation-to-record generation/update and friendly countdown formatting.

Duration cases:

- `hr`, `hrs`, `hour`, `hours`;
- `min`, `mins`, `minute`, `minutes`;
- `sec`, `secs`, `second`, `seconds`;
- mixed whitespace/case and omitted zero units;
- malformed, duplicated, negative, or unitless values return `null`.

Exit evidence: focused unit tests for validators, URL admission, IDs, generation transitions, and duration parsing.

### WP2 — Fixture-backed Training parser

Deliverables:

- add/sanitize the required current fixtures and fixture provenance README;
- implement a pure `parseTraining(document, school, observedAt)`;
- return zero or more validated observations without Chrome APIs;
- never throw on missing/unexpected markup;
- skip an ambiguous row instead of inventing a pet, state, or time;
- support the exact active and `Course Finished!` forms demonstrated by fixtures;
- emit only redacted local diagnostics (school + reason), never page HTML.

Do not add generalized selectors for states not represented in a current fixture.

Exit evidence:

- active and ready fixtures pass for all three schools;
- malformed/whitespace/missing-field fixtures fail safely;
- multiple rows are tested only if the current captured page demonstrates them;
- mutation-free parser test confirms input DOM is unchanged.

### WP3 — Content observation pipeline

Deliverables:

- run at `document_idle` on the three narrow manifest matches;
- require the exact runtime URL classifier before parsing;
- parse once and send `TRAINING_OBSERVED` only when there is at least one valid observation;
- no fetch, reload, mutation, gameplay event dispatch, generic click helper, timer, or periodic observer;
- background handler validates `sender.url` and the entire payload before any write.

If live acceptance proves delayed client-side timer rendering, document that evidence and add a bounded local parse retry only; it must stop after a few seconds and never navigate or request the site.

Exit evidence: local-document integration test proves supported URL -> validated message, while wrong query/host/malformed markup produces no write.

### WP4 — Store and alarm reconciliation

Deliverables:

- storage adapter with defaults, validation, schema check, serialized mutation, upsert, list, remove, settings update;
- save reminder state before alarm creation;
- one one-shot alarm for each enabled future scheduled reminder;
- reconciliation after listener registration at worker startup, plus `runtime.onInstalled` and `runtime.onStartup`;
- mark past-due reminders Ready;
- recreate missing alarms, replace meaningfully wrong alarm deadlines, and remove only orphan alarms bearing this extension's prefix;
- removal clears its alarm and visible notification;
- disabling Training clears its alarms but preserves records;
- re-enable schedules future records and marks past records Ready without retroactive notification.

Use injected clock and Chrome API adapters for deterministic tests. Do not call `chrome.alarms.clearAll()`.

Exit evidence: store/alarm tests cover restart, orphan, missing alarm, changed due time, past-due/wake, disabled setting, remove, and concurrent mutation ordering.

### WP5 — Notifications and explicit navigation

Deliverables:

- alarm handler checks prefix, current record, generation, settings, and due time;
- transition due record to Ready and show at most one completion notification per generation;
- valid local icon, concise Training copy, stable notification ID;
- notification click resolves record/generation, reconstructs canonical URL, and calls only `chrome.tabs.create`;
- Test Notification action is local and works without a Neopets tab;
- denied OS/browser permission is handled without changing reminder correctness or retry-looping.

Exit evidence: tests prove dedupe across repeated alarms/reconciliation/restart, no HTTP activity before click, allowed URL only, and no gameplay action after tab creation.

### WP6 — Popup vertical slice

Deliverables:

- sections: Ready and Upcoming (ascending `dueAt`);
- each row: pet, school label, friendly remaining/Ready state, last-observed local time, Open, Remove;
- settings: Training reminders on/off and completion notifications on/off;
- Test Notification button and a short local-only/fair-play note;
- explicit empty state explaining that the user must manually visit a supported Training status page;
- refresh countdown while the popup is open using local state only;
- all popup operations use typed runtime messages; no direct site access.

Accessibility minimum: semantic buttons/headings, keyboard operation, visible focus, sufficient contrast, and status text that does not rely only on color.

Exit evidence: popup tests for empty/upcoming/ready/disabled/error states and a manual keyboard pass.

### WP7 — Full acceptance and handoff

Run, record, and distinguish automated from manual evidence:

1. `npm ci`
2. aggregate static/type/unit/integration/build check
3. inspect built manifest permissions and content matches
4. load `dist/` unpacked in Chrome
5. manually visit each of the three supported status URLs represented by fixtures
6. verify capture, stable upsert on revisit, tab-close persistence, Ready/Upcoming display, remove, toggles, and Test Notification
7. verify a short test deadline/alarm notification, click-to-open, worker suspension/restart, full browser restart, and past-due behavior after sleep/wake or equivalent clock-controlled test plus one real wake check
8. inspect network activity: no Neopets request at observation-message processing, alarm time, popup countdown, worker startup, or notification creation; ordinary navigation occurs only after explicit Open/click
9. search production source and `dist/` for forbidden APIs and unexpected hosts
10. provide a concise final report: files changed, commands/results, manual checks, fixture provenance, exact permissions, known limitations, and any deferred item

Phase 1 is not complete if any core-path check is replaced only by “build succeeded.”

## 7. Acceptance matrix

| ID | Requirement | Required evidence |
| --- | --- | --- |
| P1-A01 | All three current Training pages parse active and ready state | Sanitized fixture tests plus one manual page check per school/state available to the owner |
| P1-A02 | Manual visit is required to learn state | Empty fresh profile remains empty until a supported page is manually opened |
| P1-A03 | Reminder survives tab close and worker suspension | Stored record and reconstructed alarm after worker restart |
| P1-A04 | Browser restart does not lose state | Unpacked/manual restart evidence; missing alarm is recreated from storage |
| P1-A05 | Sleep/past-due becomes Ready without waking the Mac | Clock-controlled test plus real wake check where practical |
| P1-A06 | At most one completion notification per generation | Repeated handler/reconciliation/restart tests and stable notification ID |
| P1-A07 | Notification/popup click only opens canonical status page | URL allowlist test and manual click check |
| P1-A08 | No automatic Neopets request or gameplay action | Safety audit, built-bundle search, and manual network trace |
| P1-A09 | Minimal permissions | Built manifest contains only `storage`, `alarms`, `notifications` and three narrow content matches |
| P1-A10 | Malformed/redesigned markup fails safely | Fixture tests: no throw, no fabricated deadline, existing record retained |
| P1-A11 | Disable/remove semantics are deterministic | Store/alarm/popup tests for preserve-on-disable and delete-on-remove |
| P1-A12 | Local privacy boundary holds | No backend/telemetry/account credential collection; fixture review shows sanitization |

## 8. Luna execution rules

- Read `AGENT_BRIEF.md`, `01-policy-safety.md`, `02-feature-whitelist.md`, `03-architecture.md`, `05-parser-spec.md`, `06-notifications-and-lifecycle.md`, and `07-testing-and-audit.md` before implementation.
- Work in the WP order above, except for the explicitly allowed fixture-blocked domain work in section 3. Run the smallest relevant test after each change, then the aggregate check at each WP boundary.
- Keep changes narrow and preserve unrelated/user files. Do not rewrite the planning pack to fit an implementation shortcut.
- Stop for owner review before adding a permission, host, Neopets request, automatic navigation, gameplay action, remote storage, unsupported activity, or invented selector.
- Do not publish, push, deploy, submit to the Chrome Web Store, or contact community reviewers in Phase 1.
- If the current page contradicts a fixture or documented semantic, preserve the failing fixture/evidence and stop that parser path instead of guessing.

## 9. Deferred decisions

These do not block Phase 1 and must not be pulled forward:

- final product name/branding and production icon;
- Chrome Web Store packaging and whether generated `dist/` is committed;
- Grave Danger fixture/semantics;
- Neolodge buffer semantics;
- Kadoatery manual-window UX;
- early reminders, internationalization, cross-device sync, analytics, and community/public release review.
