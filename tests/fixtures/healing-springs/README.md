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
| `success-heal.html` | Not captured | Requires a human to click Heal and then expose the rendered result; the capture agent did not click it. |
| `cooldown.html` | Not captured | No cooldown result was currently rendered. |
| `success-shop.html` | Not captured | No shop purchase was performed; the capture agent did not click Buy. |

## Timer semantics observed

No numeric activity cooldown remaining value was visible in the captured page.
The only `MM:SS`-like text observed was the site clock (`6:53:42 am NST`),
not a Healing Springs cooldown. The visible copy is a fixed explanatory
message, including the limitation to one customer per visit.

This does not validate the proposed `observedAt + 30 minutes` model. A future
manual success fixture is still required before discussing that design further.

## Sanitization

- Preserved only the page heading, fixed Healing Springs message, and visible
  `Heal my Pets` control.
- Removed account chrome, balances, inventory, potion/shop listings and prices,
  hidden form fields, URLs, images, and unrelated navigation.
- No cookies, tokens, credentials, account identifiers, or real pet names were
  saved.

Healing Springs is not on the feature whitelist; this fixture is research-only
and does not authorize parser or business implementation.
