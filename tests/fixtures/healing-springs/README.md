# Healing Springs fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| URL | `https://www.neopets.com/faerieland/springs.phtml` |
| Page family | Healing Springs |
| Capture method | User manually opened the rendered page in Chrome; the DOM was read-only inspected. The capture agent did not click Heal, Buy, or any other gameplay control. |
| Browser | Chrome via the connected read-only browser surface; exact build was not exposed. |
| Visible state | Heal action available on the currently rendered page. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `available.html` | Available | Contains the rendered Healing Springs message and `Heal my Pets` submit control. |
| `success-heal.html` | Not captured | User manually clicked Heal, but the success result was no longer available when captured; no success markup was fabricated. |
| `cooldown.html` | Cooldown | User manually clicked Heal; the currently rendered page showed `Sorry! - My magic is not fully restored yet. Please try back later.` |
| `success-shop.html` | Not captured | No shop purchase was performed; the capture agent did not click Buy. |

## Timer semantics observed

No numeric activity cooldown remaining value was visible in either the
available or cooldown page. The cooldown state uses fixed copy:
`Sorry! - My magic is not fully restored yet. Please try back later.` The only
`MM:SS`-like text observed earlier was the site clock (`6:53:42 am NST`), not a
Healing Springs cooldown.

The user manually clicked Heal, but the success-heal view was not retained
after the accidental transition to cooldown. This does not validate the
proposed `observedAt + 30 minutes` model; a future manual success fixture is
still required before discussing that design further.

## Sanitization

- Preserved only the page heading, fixed Healing Springs message, and visible
  `Heal my Pets` control.
- Removed account chrome, balances, inventory, potion/shop listings and prices,
  hidden form fields, URLs, images, and unrelated navigation.
- No cookies, tokens, credentials, account identifiers, or real pet names were
  saved.

Healing Springs is not on the feature whitelist; this fixture is research-only
and does not authorize parser or business implementation.
