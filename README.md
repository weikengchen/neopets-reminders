# Neopets Reminder Extension — Development Plan

**Status:** implementation-ready planning pack  
**Prepared:** 2026-08-10  
**Target:** Chrome Manifest V3 extension, local-only, reminder/countdown scope

## 1. Product definition

Build a small Chrome extension that remembers **when the player should return** to a Neopets activity.

The core invariant is:

> **Observe, never act.**
>
> The player manually opens a Neopets page. The extension may read timer/status information already rendered to that player, store a local deadline, schedule a browser notification, and later open the relevant page only after an explicit user click. It must not refresh, submit, claim, start, purchase, feed, train, navigate, or otherwise perform gameplay automatically.

This is intentionally narrower than a general “Neopets helper.” V1 is a timer companion.

## 2. Why this boundary

Neopets' current Play Fair messaging explicitly targets bots and automated gameplay. Historical Neopian Times editorials are more concrete: automated macros for dailies are prohibited, and automated page refresh is treated as playing the game for the user even if the final action remains manual.

At the same time, the r/neopets guide repository maintains a community-reviewed userscript list that says only “safe” scripts with nothing automated are allowed. That list currently includes Pet Sidebar Module, systematic-meerca's Training Timer, and Kadoatery Time Tracker. This is useful precedent, but **it is not an official TNT whitelist**.

See `01-policy-safety.md` and `references.md`.

For the locked, implementation-level Training vertical-slice handoff, see
`09-phase-1-engineering-plan.md`.

## 3. Recommended V1 scope

### P0 — implement first

1. **Training timers**
   - Swashbuckling Academy
   - Mystery Island Training School
   - Secret Ninja Training School
   - Strongest precedent: r/neopets-approved Training Timer + approved Pet Sidebar Module.

2. **Grave Danger timer**
   - Precedent: Pet Sidebar Module explicitly documents passive gathering of the Grave Danger timer and reminder display.

### P1 — after P0 works

3. **Neolodge checkout timer**
   - Precedent: Pet Sidebar Module explicitly documents passive gathering of the Neolodge timer.
   - Parser semantics need careful validation because the existing userscript adds a buffer around the displayed checkout estimate.

4. **Kadoatery window timer**
   - Precedent: r/neopets-approved Kadoatery Time Tracker.
   - Existing script uses a user-supplied last-known refresh time and can send desktop notifications.
   - Do not invent a hidden-state detector; mirror the same observable/manual-input model.

### Not V1

- Generic “all dailies” automation.
- Background checking of any Neopets page.
- Auto-refreshing Kadoatery, shops, Snowager, etc.
- Completing training, starting the next course, buying codestones/dubloons, feeding Kadoaties, claiming rewards, or any other gameplay action.
- Any new timer merely because it seems harmless. New activity support requires a precedent review under `02-feature-whitelist.md`.

## 4. Technical architecture

```text
Human opens supported Neopets page
        ↓
Narrow content script reads rendered DOM
        ↓
Pure parser returns observed reminder(s)
        ↓
Service worker validates + stores in chrome.storage.local
        ↓
chrome.alarms schedules local deadline
        ↓
Neopets tab may close
        ↓
Alarm fires → chrome.notifications
        ↓
Human clicks notification / popup button
        ↓
chrome.tabs.create(saved Neopets URL)
        ↓
Human performs gameplay manually
```

`chrome.storage.local` is the source of truth. Alarms are reconstructed when necessary; do not rely solely on an in-memory timer or service-worker lifetime.

## 5. Suggested stack

- TypeScript
- Manifest V3
- Vite or a minimal esbuild-based extension build
- No React required for V1; popup is small enough for vanilla TS/HTML or Preact
- Vitest for parser/unit tests
- Playwright or Puppeteer only against **local fixtures** for extension integration tests
- ESLint + a custom/static safety check for prohibited network/gameplay APIs

No backend is required.

## 6. Minimal permissions

Start with:

```json
{
  "permissions": ["storage", "alarms", "notifications"]
}
```

Use narrowly scoped content-script `matches` for supported Neopets pages. Do not request `cookies`, `webRequest`, `declarativeNetRequest`, or broad network permissions.

Opening a saved Neopets URL is allowed only in response to a user click on the extension UI or notification.

## 7. Execution order

1. Read `01-policy-safety.md` and lock the invariant.
2. Read `02-feature-whitelist.md`; implement **Training only** first.
3. Create the MV3 shell and storage schema from `03-architecture.md`.
4. Implement pure Training parsers using local HTML fixtures.
5. Implement reminder reconciliation and alarms.
6. Implement notifications and click-to-open.
7. Run the complete safety/test checklist in `07-testing-and-audit.md`.
8. Add Grave Danger.
9. Only then consider Neolodge and Kadoatery.
10. Before public release, follow `08-release-community-review.md`.

## 8. Definition of done for V1

V1 is done when:

- A user can manually visit a supported training-status page and the extension captures all visible training deadlines.
- Closing the Neopets tab does not remove the reminders.
- A Chrome/macOS notification appears around the completion time when browser/OS notifications are permitted.
- Clicking the notification opens the saved status page but performs no action there.
- Browser restart and extension service-worker suspension do not lose reminder state.
- Device sleep is handled gracefully: missed reminders become “Ready now” after wake.
- The codebase has no Neopets background fetch/polling, no auto-refresh, and no gameplay DOM actions.
- All parser behavior has fixture tests.

## 9. Important disclaimer

This pack is a conservative engineering interpretation of public Neopets rules and community precedents, not a guarantee from TNT. Community approval of a userscript is evidence of community safety review, not official Neopets authorization.
