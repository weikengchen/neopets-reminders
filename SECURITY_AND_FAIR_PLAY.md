# Security and Fair Play

## Observe, never act

This extension is a **local reminder companion**. It reads timer information already rendered on Neopets pages that **you** open, stores deadlines locally, and shows browser notifications when it is time to return.

It does **not** automate gameplay.

## Permitted

- Read DOM already rendered because you navigated to the page
- Parse a displayed countdown or status
- Store a local absolute deadline
- Show countdown/status in the extension popup
- Schedule a local Chrome notification
- Open a supported Neopets page only after you click the popup or a notification

## Prohibited

- Background `fetch`/XHR/polling of Neopets
- Auto-refresh of any Neopets page
- Auto-submit forms or programmatic gameplay clicks
- Claiming rewards, starting/completing training, buying items automatically
- Using a timer to trigger a Neopets request
- Keeping a background page alive to repeatedly inspect the site

## Permissions (Phase 1)

- `storage` — local reminder state only
- `alarms` — local one-shot deadlines
- `notifications` — local completion alerts

No cookies, webRequest, history, downloads, or broad host permissions.

## Privacy

- No backend, telemetry, or cloud sync in Phase 1
- No passwords, cookies, session tokens, or Neopass credentials
- Pet names and reminder metadata stay in `chrome.storage.local` on your device

## Marketing language

Recommended:

> A local reminder companion for Neopets. It reads timer information from pages you manually visit and notifies you when it is time to return. It does not automate gameplay.

Avoid: “auto dailies”, “automation assistant”, “bot helper”, “approved by Neopets”.

## Community note

Community userscript lists are not official Neopets/TNT approval. Never market this extension as approved by Neopets unless TNT explicitly approves it.
