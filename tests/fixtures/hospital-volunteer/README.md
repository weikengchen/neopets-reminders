# Hospital Volunteer fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| URL | `https://www.neopets.com/hospital/volunteer.phtml` |
| Page family | Volunteer Centre / active volunteer shifts |
| Capture method | User manually opened the rendered page in Chrome; the DOM was read-only inspected and reduced to small local fragments. No Join, Collect, Cancel, refresh, or other gameplay control was activated by the capture agent. |
| Browser | Chrome via the connected read-only browser surface; exact build was not exposed. |
| Focus | The Hospital tab was the most recently opened supported tab, but the connected browser surface did not expose a reliable focused-tab flag. Treat this active snapshot as provisional evidence, not proof of focused-only timing behavior. |

## Files

| File | State | Observation |
| --- | --- | --- |
| `active.html` | Active | Two visible volunteer rows with `Time Remaining` values `01:17:22` and `01:17:28`; both show `is volunteering!`. |
| `malformed.html` | Negative | Handwritten invalid timer text; not a site capture. |
| `available.html` | Not captured | The currently observed page had active rows; no join/available state was manually opened. |
| `ready.html` | Not captured | No completed/collect state was manually opened. |

## Focus and timer reliability

The visible timer is composed of digit spans and the live page includes a
client-side interval. During a short read-only comparison in the current tab,
the two active values changed from `01:17:13` / `01:17:19` to
`01:17:11` / `01:17:17`. Because focus could not be independently confirmed,
this is recorded only as an observed snapshot/tick, not as proof that the timer
is reliable while focused or backgrounded.

- Focused fresh-load ticking: not independently confirmed by the browser
  surface.
- Reload effect: not tested; the capture agent did not reload the page.
- Background sample: not captured and not treated as production truth.
- Future interpretation: use a focused manual load/reload as a one-time
  snapshot; do not rely on a long-lived background tab to update the value.

## Sanitization

- Replaced visible pet names with `FixturePetHospital01` and
  `FixturePetHospital02`.
- Removed account chrome, balances, inventory, sidebar content, image URLs,
  inline scripts, inline event handlers, data identifiers, and form/navigation
  URLs.
- Preserved the `vc-fight-details`, `vc-fight-status`, timer digit spans, status
  text, volunteer text, and visible button shape needed for review.
- No cookies, tokens, credentials, account identifiers, or real pet names were
  saved.

Hospital Volunteer is not yet on the feature whitelist; these fixtures are
research-only and do not authorize parser implementation.
