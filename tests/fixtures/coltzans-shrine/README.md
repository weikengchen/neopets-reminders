# Coltzan's Shrine fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-12 |
| Final URL | `https://www.neopets.com/desert/shrine.phtml` |
| Capture method | User manually opened the rendered page in Chrome, manually completed one Approach visit, and later manually revisited before the interval elapsed. Only small DOM fragments were read afterward. This was not automated scraping. The capture agent did not click Approach or any other gameplay control. |
| JN interval note | Jellyneo reference: once every 13 hours; resets at 12:26 AM NST. Product reference only; not written into production code. Source: `https://www.jellyneo.net/?go=dailies` |
| Numeric remaining on cooldown page? | No. The too-early page showed only fixed text and no numeric remaining or timestamp. |
| Exact cooldown / success sample text (redacted) | Success/no-reward sample: `FixturePet01 walks slowly up to the strange shrine...` / `A chill wind picks up, and then dies down again...` / `Awww, nothing happened.` Too-early cooldown sample: `Nothing happens.` / `Maybe you should wait a while before visiting the shrine again....` |
| States captured / missing | Captured: available, visited/success with no reward result, cooldown/too-early revisit. Missing: none of the requested Shrine states. |
| Sanitization | Removed account header, NP/NC, sidebar, navigation, images, image URLs, tracking, form action, hidden controls, and account identifiers. Replaced the real pet name with `FixturePet01`. Preserved the heading, result paragraphs, `shrine-scene` class, result formatting, and return-button class/label. |
| Host note | `www.neopets.com` |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `available.html` | Available | Rendered page showed the Shrine explanation and `Approach the Shrine` submit control. |
| `success.html` | Visited / no reward result | After the user's manual Approach visit, the page showed the Shrine scene, wind text, and `Awww, nothing happened.` The visit is treated as successful even though no reward was shown. |
| `cooldown.html` | Cooldown / too-early revisit | After the user's manual revisit before the interval elapsed, the page showed `Nothing happens.` and `Maybe you should wait a while before visiting the shrine again....`. |

No numeric cooldown or remaining-time text was observed. The JN interval is
recorded only as provenance/product research and must not be treated as server
evidence or hard-coded into the extension.

## Too-early cross-check

The live page's cooldown text is:

> Nothing happens.
>
> Maybe you should wait a while before visiting the shrine again....

Jellyneo's [Coltzan's Shrine guide](https://www.jellyneo.net/?go=coltzansshrine)
describes this as the specific result for attempting another approach on the
same day before 13 hours have elapsed, and quotes the same second sentence.
The guide separately lists several random no-prize outcomes (such as wind,
warmth, tingling, laughter, or glowing hands). Those are normal completed
visits and must not be conflated with this cooldown state. The guide's 13-hour
limit and approximately 12:26 AM NST reset remain product notes only.

This directory is fixture research only. It does not authorize a parser,
whitelist entry, gameplay action, or business implementation.
