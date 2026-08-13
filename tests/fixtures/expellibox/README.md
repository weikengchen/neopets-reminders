# Qasalan Expellibox fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-12 |
| Final URL | `https://ncmall.neopets.com/mall/shop.phtml?page=giveaway` |
| Capture method | User manually opened the rendered page in Chrome. The available state was read before any agent interaction; the user then manually clicked `Start Game`, after which the result and post-use cooldown states were read-only inspected. This was not automated scraping. The capture agent did not click, throw a scarab, submit a form, purchase, or perform any gameplay action. |
| JN interval note | Jellyneo reference: once every 7 hours 7 minutes. The current page copy says “You may only deposit a scarab once per day.” These are product/reference observations only; no interval is written into production code. Source: `https://www.jellyneo.net/?go=dailies` |
| Numeric remaining on cooldown page? | No. The previously captured cooldown page showed no numeric remaining value; it used a fixed wait-until-tomorrow message. The current available page has no timer. |
| Exact cooldown / success sample text (redacted) | Post-use cooldown: `What are you doing?! You can't just dump them in there! It's a series of tubes! Bring that scarab back tomorrow and you can deposit it then.` Result: `The scarab only went so far as Sakhmet! ... There's a Sand Cherries for your trouble. Come back tomorrow to deposit another scarab.` Available rendered signal: `Start Game` was visible inside the Ruffle canvas. |
| States captured / missing | Captured: available/start screen, terminal result, prior fixed cooldown, post-use cooldown. Missing: non-ncmall surface/result variant. |
| Sanitization | Removed account header, NP/NC, sidebar, pet/account identifiers, unrelated navigation and mall content, tracking, form/action details, hidden identifiers, and unrelated image URLs. Preserved the Expellibox title, explanatory status copy, `#show_NCGiveawayGame`, and the actual Ruffle embed host attributes. The visible `Start Game` and result text are documented in capture comments because they are canvas-rendered rather than light-DOM text; the incidental reward name is not a stable parser signal. |
| Host note | Final host is `ncmall.neopets.com`, not `www.neopets.com`. The JN HTTP URL resolved to this HTTPS address in the manually opened browser tabs. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `available.html` | Available / start screen | The rendered Ruffle game showed `Start Game`; the page light DOM contains the `#show_NCGiveawayGame` embed container. |
| `success.html` | Terminal result | User manually clicked `Start Game`; the Ruffle canvas showed a result and the instruction to come back tomorrow. The URL and page light DOM remained unchanged. |
| `cooldown.html` | Cooldown | The rendered page showed a fixed message saying the scarab could be deposited tomorrow. |
| `used-cooldown.html` | Post-use cooldown | After the user manually completed the game, the rendered page light DOM showed the fixed wait message and no longer contained the Ruffle game embed. |

The cooldown page contains no numeric remaining time. The JN 7h7m interval and
the page's “once per day” copy disagree, so both remain provenance/product
notes and must not be treated as current server state or hard-coded into the
extension.

## Rendered-game observation

Clicking `Start Game` changed the Ruffle canvas from the start screen to a
terminal result, but did not change the final URL or the surrounding page light
DOM. The result and “Come back tomorrow...” text were not present in
`document.body.innerText`; they were rendered by the embedded game canvas.
Therefore `success.html` preserves the real surrounding HTML and records the
observed canvas text in its capture comment without inventing a result DOM
node. A future production parser must not assume that the outer page DOM alone
can detect this result.

The post-use state is separately recorded in `used-cooldown.html`: after the
canvas result, the page rendered a `.contentModuleBody` paragraph with the
fixed “Bring that scarab back tomorrow...” message, no numeric remaining, and
no `#show_NCGiveawayGame ruffle-embed`. The earlier `cooldown.html` remains a
real fixed-cooldown variant that included a `Remove Items` control; both are
kept because the rendered structures differ.

This directory is fixture research only. It does not authorize a parser,
whitelist entry, gameplay action, purchase, or business implementation.
