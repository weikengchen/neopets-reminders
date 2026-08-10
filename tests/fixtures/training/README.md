# Training fixtures

## Capture provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| Capture method | User manually opened an already logged-in Chrome tab; the rendered DOM was read-only inspected and reduced to small local fragments. This was not automated scraping. |
| Browser | Chrome via the connected read-only browser surface; exact browser build was not exposed. |
| Site/version note | The rendered page had no explicit site version label; the page footer showed the current 2026 copyright line. |
| Multi-pet rows | Yes. The Mystery Island page visibly showed six rows: five not on a course and one active. See `multiple-pets.html`. |

## Files

| File | School | State | Exact URL / page family | Evidence status |
| --- | --- | --- | --- | --- |
| `mystery-active.html` | Mystery Island Training School | Active; `Time till course finishes : 1 hrs, 10 minutes, 45 seconds` | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the current manually opened rendered page |
| `mystery-ready.html` | Mystery Island Training School | Ready; `Course Finished!` with `Complete Course!` control | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the current manually opened rendered page; only the finished row retained |
| `multiple-pets.html` | Mystery Island Training School | Six visible rows; one active and five `not on a course` | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the same manually opened rendered page |
| `pirate-ready.html` | Swashbuckling Academy | Six visible rows; all `not on a course`, no active row, no `Course Finished!` text observed | `https://www.neopets.com/pirates/academy.phtml?type=status` / Training status | Captured from the current manually opened rendered page |
| `malformed.html` | N/A | Handwritten malformed negative fixture | N/A | Added locally for safe-failure tests; not a site capture |

The following required current captures were not available in the browser during
this collection and are intentionally not fabricated:

- `pirate-active.html`
- `ninja-active.html`
- `ninja-ready.html`

## Sanitization

- Removed the account header, account name, event text, NP/NC balances,
  inventory/navigation/sidebar content, forms, tracking content, and pet image
  URLs.
- Replaced every visible pet name with `FixturePetMystery` or
  `FixturePet01`–`FixturePet06`.
- Replaced visible pet stats with synthetic zero values while retaining the
  status-row/table shape and the observed timer wording/units.
- No cookie, token, password, Neopass data, email, account identifier, or
  credential was saved.

These fixtures preserve only the small Training status structure needed for
future parser review. They do not establish production selectors, and
`TRAINING_FIXTURES_AVAILABLE` remains unchanged until the owner explicitly
reviews the complete fixture set.
