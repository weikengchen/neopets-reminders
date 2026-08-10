# Implementation Plan

## Milestone 0 — repository and guardrails

### Tasks

- [ ] Create TypeScript MV3 extension repository.
- [ ] Add `storage`, `alarms`, `notifications` permissions only.
- [ ] Add narrowly scoped `content_scripts.matches` for Training P0 pages.
- [ ] Create shared types and message schema.
- [ ] Add `SECURITY_AND_FAIR_PLAY.md` by adapting `01-policy-safety.md`.
- [ ] Add automated safety audit script before feature code grows.

### Exit criteria

- Extension loads unpacked in Chrome.
- Popup opens.
- Service worker starts without errors.
- No Neopets page is modified yet.

---

## Milestone 1 — Training parser with fixtures

### Capture fixtures manually

Visit each training status page yourself and save/sanitize representative HTML snippets:

- Mystery Island: active training
- Mystery Island: course finished
- Pirate Academy: active training
- Pirate Academy: course finished
- Ninja School: active training
- Ninja School: course finished
- multiple pets if the page shows multiple rows
- Training Fortune Cookie / altered timer formatting if currently visible

Do not build a crawler to acquire fixtures.

### Parser requirements

Input should produce zero or more observations:

```ts
{
  kind: 'training',
  petName: 'Example',
  school: 'mystery',
  remainingMs: 5_400_000,
  ready: false
}
```

If the page says `Course Finished!`, output ready state / `dueAt <= observedAt`.

### Defensive parsing

- Never throw on unexpected markup.
- If pet name is missing, skip that row.
- If time cannot be parsed, log a local debug diagnostic but do not invent a deadline.
- Recognize singular/plural hour/minute/second forms.
- Test exact page text observed in current fixtures.

### Exit criteria

- Fixture tests cover all three schools.
- No network code is involved.
- No DOM mutation occurs.

---

## Milestone 2 — content → background observation pipeline

### Tasks

- [ ] Content script checks supported page.
- [ ] Extract/parse current rendered status.
- [ ] Send `REMINDER_OBSERVED` message.
- [ ] Service worker validates message and canonicalizes source URL.
- [ ] Upsert stable reminder records.

### Update rules

On each manual revisit:

- replace old due time with the newly observed value;
- if the pet is no longer training on that school, clear/resolve the corresponding reminder only when the page provides enough evidence to do so;
- never infer remote state from time alone beyond `scheduled → ready`.

---

## Milestone 3 — alarm reconciliation

### Tasks

- [ ] Store all reminders before creating alarms.
- [ ] Create one alarm per scheduled reminder.
- [ ] On worker initialization, reconcile stored reminders against `chrome.alarms.getAll()`.
- [ ] Add `runtime.onStartup` reconciliation.
- [ ] Add `runtime.onInstalled` reconciliation/migration.
- [ ] Handle alarms firing after device wake.

### Important rule

A deadline becoming due changes only local state and creates a notification. It must never trigger a Neopets request.

---

## Milestone 4 — notifications

### Tasks

- [ ] Request `notifications` extension permission via manifest.
- [ ] When alarm fires, mark reminder ready and create notification.
- [ ] Use stable notification IDs.
- [ ] Store `notifiedAt` to prevent accidental duplicate storms.
- [ ] On click, open canonical activity URL.
- [ ] Test macOS notification permissions disabled/enabled.

### UX

Training example:

```text
Training complete
ExamplePet is ready at Mystery Island Training School.
```

No “Complete training” button. “Open” is acceptable because it only navigates after user action.

---

## Milestone 5 — popup dashboard

### Minimum UI

```text
Neopets Reminders

READY
ExamplePet — Mystery Island Training     Open

UPCOMING
OtherPet — Pirate Academy               42m
Grave Danger                            2h 11m

Last observed: 16:41
```

### Settings

- Notifications on/off
- Training reminders on/off
- Grave Danger reminders on/off
- Optional “notify N minutes early” only if it remains local and informational

Do not create settings that increase site automation.

---

## Milestone 6 — Grave Danger

### Tasks

- [ ] Manually capture current page fixtures.
- [ ] Document the exact visible countdown/status text.
- [ ] Implement pure parser.
- [ ] Add narrowly scoped page match.
- [ ] Add reminder kind and notification copy.
- [ ] Re-run safety audit.

### Exit criteria

Equivalent flow to Training: manual page observation → local deadline → notification → click-to-open.

---

## Milestone 7 — P1 timers

### Neolodge

First resolve semantics of PSM's one-day buffer. Do not simply copy its arithmetic.

### Kadoatery

Start by reproducing the approved script's manual last-known-window input plus local calculation. Do not add auto-refresh or background state discovery.

---

## Milestone 8 — public release readiness

- [ ] Privacy disclosure: local-only by default.
- [ ] Plain-language fair-play statement.
- [ ] Source code public.
- [ ] No obfuscation/minification requirement for review build; production may minify but source maps/repository should make auditing easy.
- [ ] Ask r/neopets/Discord moderators to review the extension behavior/code before advertising it there.
- [ ] Never describe community review as TNT approval.
