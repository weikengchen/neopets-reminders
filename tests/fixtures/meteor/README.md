# Meteor Crash Site fixtures

## Provenance

| Field | Value |
| --- | --- |
| Capture date | 2026-08-14 (successful result; earlier available/action-selection/cooldown and failure captures are also retained) |
| Final URL | `https://www.neopets.com/moon/meteor.phtml` for the successful result and the available/cooldown page; `https://www.neopets.com/moon/meteor.phtml?getclose=1` for the post-`Take a chance` action-selection page; `https://www.neopets.com/moon/meteor.phtml?errorm=3` for the no-prize result. |
| Page family | Meteor Crash Site 725-XZ |
| Capture method | The user manually completed the Meteor Crash Site flow and opened the successful result. The capture agent only read already-rendered DOM and made a read-only visual check; it did not click a game control, select an action, submit a form, refresh, or fetch. |
| Browser | Chrome via the connected read-only browser surface; exact build was not exposed. |
| Visible state | The successful page showed the cracked-meteor result, prize name `Proto-force 5000 Helmet`, a fixed 400x400 cracked-meteor image, an 80x80 prize icon, and `Return to Kreludor`. |

## Files

| File | State | Evidence |
| --- | --- | --- |
| `available.html` | Captured | The rendered page showed the Meteor Crash Site prompt and `Take a chance` / `Return to Kreludor` controls. |
| `action-selection.html` | Captured | After the user's manual `Take a chance` click, the rendered page showed the meteor description, `Select Action`, `Poke the meteor with a stick.`, `Run away. Now!`, and `Submit`. It is not a final outcome. |
| `result-miss.html` | Captured | The saved fragment reflects the rendered no-prize page after a manually selected action and `Return to Kreludor`; two real no-prize copy variants are recorded below. |
| `result-prize.html` | Captured | The rendered page showed the success lead-in, `Proto-force 5000 Helmet`, the fixed cracked-meteor artwork, and `Return to Kreludor`; image resources are omitted from the sanitized fragment. |
| `cooldown.html` | Captured | The user identified the rendered canonical page with `It's gone!` and `Return to Kreludor` as the cooldown state. |
| `too-hot.html` | Not captured | No too-hot copy was observed. |
| `scientist-away.html` | Not captured | No Grundo scientist away copy was observed. |

## Timer and observed copy

No numeric remaining-minutes field was visible. The only time-like text was the
page's NST clock, not an activity cooldown countdown.

Timing notes from the user's manual run:

- The 60-minute visit cooldown starts when the user clicks `Take a chance`.
- Every subsequent manual action/step also requires a one-hour cooldown.

These are user-provided timing observations, not numeric values rendered by the
page. In the earlier no-prize run, the user selected/submitted the action and
the result was then read-only captured; the same observe-only boundary was used
for this successful result.

Exact observed sentences:

- Available: `What is that glowing in the distance?`
- Available: `Do you want to find out?`
- Available: `Should you risk the danger?`
- Action-selection: `You reach the object and realize that it's a meteor, fallen from the dark skies of Kreludor.`
- Action-selection: `What to do next?`
- Action-selection controls: `Select Action`, `Poke the meteor with a stick.`, `Run away. Now!`, `Submit`
- No prize after the manually selected action (saved and reobserved): `Meteors are funny like that. They just don't feel like company sometimes. Try again later.`
- No prize (earlier observed variant): `This must not be your lucky day. The meteor just disappeared. Try again later.`
- Cooldown: `It's gone!`
- Prize lead-in: `The meteor has cracked open and a small object falls out.`
- Prize name: `Proto-force 5000 Helmet`
- Scientist-away: no scientist-away sentence observed.

## Sanitization

- Kept only the page heading, available prompts, action-selection text/options, result copy, prize name, and visible controls.
- The cooldown fixture keeps the observed `It's gone!` copy and `Return to Kreludor` control; its state classification comes from the user's direct observation.
- The success page visibly contained a fixed 400x400 cracked-meteor image and an 80x80 prize icon; both image resources are intentionally omitted, while the fixed-artwork observation is retained in the fixture comment and this README.
- Removed account chrome, username, NP/NC balances, pet details, search/neofriends content, site navigation/footer, clock text, hidden fields, scripts, image URLs, cookies, tokens, and account identifiers.
- The prize name is a non-identifying game item name and was retained as observed.

Meteor Crash Site remains research/capture-only; these fixtures do not authorize
parser or business implementation.
