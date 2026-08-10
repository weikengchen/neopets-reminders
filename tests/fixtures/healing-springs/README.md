# Healing Springs fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 (available/cooldown); 2026-08-11 (success-heal) |
| URL | `https://www.neopets.com/faerieland/springs.phtml` |
| Page family | Healing Springs |
| Capture method | User manually opened the rendered page in Chrome; the DOM was read-only inspected. The capture agent did not click Heal, Buy, or any other gameplay control. |
| Browser | Chrome via the connected read-only browser surface; exact build was not exposed. |
| Visible state | Heal action available on the currently rendered page. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `available.html` | Available | Contains the rendered Healing Springs message and `Heal my Pets` submit control. |
| `success-heal.html` | Success | User manually clicked Heal; the rendered dialogue said `All of your Neopets gain three hit points.` and showed the `faerie-battle` Water Faerie scene marker. |
| `cooldown.html` | Cooldown | User manually clicked Heal; the currently rendered page showed `Sorry! - My magic is not fully restored yet. Please try back later.` |
| `success-shop.html` | Not captured | No shop purchase was performed; the capture agent did not click Buy. |

## Timer semantics observed

No numeric activity cooldown remaining value was visible in either the
available or cooldown page. The cooldown state uses fixed copy:
`Sorry! - My magic is not fully restored yet. Please try back later.` The only
`MM:SS`-like text observed earlier was the site clock (`6:53:42 am NST`), not a
Healing Springs cooldown.

The success-heal fixture now provides evidence of the success event and its
rendered dialogue/image marker. It does not prove the duration of a cooldown:
the cooldown page still uses fixed copy, so the proposed `observedAt + 30
minutes` model remains a local policy rather than a server numeric value.

## Sanitization

- Preserved only the page heading, fixed Healing Springs message, and visible
  `Heal my Pets` control.
- The success fixture preserves the `faerie-battle` class marker observed on
  the rendered Water Faerie scene; its external CSS background image URL was
  removed.
- Removed account chrome, balances, inventory, potion/shop listings and prices,
  hidden form fields, URLs, images, and unrelated navigation.
- No cookies, tokens, credentials, account identifiers, or real pet names were
  saved.

Healing Springs is not on the feature whitelist; this fixture is research-only
and does not authorize parser or business implementation.
