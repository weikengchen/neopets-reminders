# Training fixtures

## Capture provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-10 |
| Capture method | User manually opened an already logged-in Chrome tab; the rendered DOM was read-only inspected and reduced to small local fragments. This was not automated scraping. |
| Browser | Chrome via the connected read-only browser surface; exact browser build was not exposed. |
| Site/version note | The rendered page had no explicit site version label; the page footer showed the current 2026 copyright line. |
| Multi-pet rows | Yes. The current Mystery Island page visibly showed six rows, all not on a course; the earlier mixed-state capture remains `multiple-pets.html`. |

## Files

| File | School | State | Exact URL / page family | Evidence status |
| --- | --- | --- | --- | --- |
| `mystery-active.html` | Mystery Island Training School | Active; `Time till course finishes : 1 hrs, 10 minutes, 45 seconds` | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the current manually opened rendered page |
| `mystery-ready.html` | Mystery Island Training School | Ready; `Course Finished!` with `Complete Course!` control | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the current manually opened rendered page; only the finished row retained |
| `mystery-available.html` | Mystery Island Training School | Available/idle; six visible rows, all `not on a course` | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the current manually opened rendered page |
| `multiple-pets.html` | Mystery Island Training School | Six visible rows; one active and five `not on a course` | `https://www.neopets.com/island/training.phtml?type=status` / Training status | Captured from the same manually opened rendered page |
| `pirate-active.html` | Cap'n Threelegs' Swashbuckling Academy | Active; `Time till course finishes : 7 hrs, 59 minutes, 59 seconds` | `https://www.neopets.com/pirates/academy.phtml?type=status` / Training status | Captured from the current manually opened rendered page; only the active row retained |
| `pirate-ready.html` | Swashbuckling Academy | Six visible rows; all `not on a course`, no active row, no `Course Finished!` text observed | `https://www.neopets.com/pirates/academy.phtml?type=status` / Training status | Captured from the current manually opened rendered page |
| `malformed.html` | N/A | Handwritten malformed negative fixture | N/A | Added locally for safe-failure tests; not a site capture |

The following required current captures were not available in the browser during
this collection and are intentionally not fabricated:

- `ninja-active.html`
- `ninja-ready.html`

## Sanitization

- Removed the account header, account name, event text, NP/NC balances,
  inventory/navigation/sidebar content, forms, tracking content, and pet image
  URLs.
- Replaced every visible pet name with synthetic `FixturePetMystery`,
  `FixturePetPirateActive`, or `FixturePet01`–`FixturePet06` names.
- Replaced visible pet stats with synthetic zero values while retaining the
  status-row/table shape and the observed timer wording/units.
- No cookie, token, password, Neopass data, email, account identifier, or
  credential was saved.

These fixtures preserve only the small Training status structure needed for
parser work. A **partial** fixture-backed parser may read evidenced states only:

- Mystery active timer rows
- Mystery `Course Finished!` ready row
- Pirate active timer row
- Idle `is not on a course` rows (observed in `mystery-available.html`, `multiple-pets.html`, and `pirate-ready.html`)
- Malformed negative cases

Still blocked for production completeness:

- Pirate true `Course Finished!` ready fixture; `pirate-ready.html` is idle only
- all Ninja fixtures (**intentional exclusion** until a Ninja pet exists)

`TRAINING_FIXTURE_GATE_COMPLETE` stays `false` until the allowed fixture set is complete.
Do not treat `pirate-ready.html` as `Course Finished!` — it is idle not-on-a-course only.

## Timer semantics (observed)

Mystery Island status time text is a **server-rendered relative snapshot** at page
load; it does not tick down in the browser. Local deadlines must be fixed at
observation time (`observedAt + duration`), not by watching the DOM.
