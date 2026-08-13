# Grave Danger fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture dates | 2026-08-10 (active); 2026-08-13 (end + selection, live navigation) |
| URL | `https://www.neopets.com/halloween/gravedanger/` |
| Page family | Explore / Grave Danger |
| Capture method | User manually opened / completed flows in Chrome. Capture was read-only. No agent clicks, Send, or Collect. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `active.html` | Active | `#gdAdventure` / `#gdActive` / `#gdRemaining` with remaining-time text |
| `end.html` | End / reward | Live marker `#gdReward` after zero-reload |
| `selection.html` | Selection | Live markers `#gdSelection` + POST `#gdForm` |
| `available.html` | Not captured | Same as selection for product purposes; extra available-only markup not stored |
| `ready.html` | Not captured | End page uses `#gdReward`; no separate ready fixture name required |
| `no-petpet.html` | **Not captured** | Must stay unsupported — do not guess |

## Sanitization

- Synthetic petpet name on active only (`FixturePetpetGD01`)
- End/selection keep only confirmed IDs; prize text and options redacted
- No cookies, tokens, account names, or real petpet names

## Classification (parser)

| Kind | Markers | Message |
| --- | --- | --- |
| active | `#gdAdventure` or `#gdActive` + parseable remaining | one snapshot |
| end | `#gdReward` | empty + `replaceScope` |
| selection | `#gdSelection` and POST `#gdForm` | empty + `replaceScope` |
| unknown / no-petpet | none of the above | **do not** clear scope |

Send and zero are full navigations; content script reinjects. `#gdRemaining` first write is delayed (~1s interval, no immediate tick).
