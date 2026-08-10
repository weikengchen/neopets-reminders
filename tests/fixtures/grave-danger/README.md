# Grave Danger fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| URL | `https://www.neopets.com/halloween/gravedanger/` |
| Page family | Explore / Grave Danger |
| Capture method | User manually opened the rendered page in Chrome; the DOM was read-only inspected. The capture agent did not navigate, send a Petpet, collect a prize, or otherwise create a gameplay state. |
| Browser | Chrome via the connected read-only browser surface; exact build was not exposed. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `active.html` | Active | Real rendered page showed a Petpet adventuring, `Status:`, and `Remaining adventuring time: 2 hours, 37 minutes, 1 second`. |
| `available.html` | Not captured | No available/send-Petpet state was observed in the manually opened page. |
| `ready.html` | Not captured | No return/finished state was observed. |
| `no-petpet.html` | Not captured | A Petpet was present in the observed active state; no no-Petpet state was observed. |

## Sanitization

- Replaced the visible Petpet name with `FixturePetpetGD01`.
- Removed account chrome, balances, inventory, sidebar content, images, image
  URLs, scripts, inline event handlers, data identifiers, and navigation URLs.
- Preserved the observed `#gdActive`, `.petpetName`, `.statusTitle`, `#gdTime`,
  and `#gdRemaining` structure plus the rendered status and remaining-time
  text.
- No cookies, tokens, credentials, account identifiers, or real names were
  saved.

## Missing states

Only the active state was available during this read-only capture. The other
files remain absent rather than being fabricated; a later manual pass may add
them when the rendered states are genuinely observed.

Grave Danger is approved for V1 in `02-feature-whitelist.md`, but its fixture
gate remains open until the remaining states can be read and sanitized.
