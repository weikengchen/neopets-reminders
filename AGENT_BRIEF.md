# Coding Agent Brief

You are implementing a Chrome Manifest V3 extension for Neopets reminders.

## Non-negotiable invariant

**Observe, never act.**

The extension can read timer/status information already rendered on a page the player manually opened, store a local deadline, schedule a local browser notification, and open the relevant Neopets page only after explicit user interaction.

It must never:

- fetch/poll Neopets in the background;
- auto-refresh Neopets;
- click Neopets gameplay controls;
- submit Neopets forms;
- claim rewards;
- start/complete training;
- purchase/search items automatically;
- perform any gameplay action on alarm fire.

## Implement in this order

1. MV3 shell + minimal permissions.
2. Storage/reminder model.
3. Training parser for the three schools using manually captured local fixtures.
4. Content-script observation → service-worker message pipeline.
5. Alarm reconciliation.
6. Notifications.
7. Popup dashboard.
8. Safety tests/audit.
9. Grave Danger parser.

Do not implement Neolodge or Kadoatery until P0 is stable.

## Source of truth

Read these before coding:

1. `01-policy-safety.md`
2. `02-feature-whitelist.md`
3. `03-architecture.md`
4. `07-testing-and-audit.md`
5. `09-phase-1-engineering-plan.md` for the detailed Training vertical-slice execution contract

Do not add an activity that is not approved in `02-feature-whitelist.md`.

## Key technical decision

`chrome.storage.local` is authoritative. `chrome.alarms` is reconstructed from storage and must never be used to trigger a site request.

## Stop conditions requiring owner review

Stop and ask the owner before:

- adding a permission not listed in the plan;
- adding any Neopets network request;
- adding automatic navigation;
- changing a timer from passive observation to active checking;
- supporting a new activity not in the whitelist;
- changing user data from local-only to cloud/server storage.
