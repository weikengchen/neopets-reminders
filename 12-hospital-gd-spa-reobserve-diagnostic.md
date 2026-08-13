# Hospital Volunteer & Grave Danger — In-page SPA / Delayed DOM Diagnostic

**Status:** diagnostic playbook for Luna + owner live session  
**Goal:** Explain why timers are missed without a full page reload, and design a **minimal, observe-only** re-observation strategy.  
**Non-goal (this doc):** implementing the final fix, automating Join/Collect/Send, or adding privileged APIs.

Related prior work:

- Expellibox async fill: local DOM poll until classified (`src/content/expellibox-observe.ts`)
- Grave Danger one-shot delayed retry (~800ms) already exists for remaining text
- Hospital parser is snapshot-based on `.vc-fight-details` at parse time

---

## 1. Problem statement (owner)

### 1.1 Hospital Volunteer

- URL: `https://www.neopets.com/hospital/volunteer.phtml`
- Starting a new shift (and likely Collect / Cancel flows) happens **inside the existing page**.
- **No full navigation** → MV3 content script does **not** re-run `document_idle` observe.
- Result: extension keeps stale state until the user **refreshes or re-opens** the page.
- Owner must manually reload to pick up new active timers / clear ready rows.

### 1.2 Grave Danger

- URL: `https://www.neopets.com/halloween/gravedanger/` (and variants)
- After starting an expedition (user action), the **countdown / remaining UI may appear only after a short delay**.
- Current code: one optional ~800ms retry when shell exists but remaining empty.
- May still miss slower fills, or miss **post-action** updates if observe already finished before the user clicks Send.

### 1.3 Shared root class

| Pattern | Hospital | Grave Danger |
| --- | --- | --- |
| Full page load observe | Yes | Yes |
| In-page DOM update without navigation | **Yes (primary bug)** | Possible after start |
| Delayed async fill after load | Possible | **Yes (known-ish)** |
| Delayed fill after **user** action | **Yes** | **Yes** |

This is the same family as Expellibox’s late `#main_div` fill, but Hospital/GD are **richer UIs** and may use different mechanisms (XHR + `innerHTML`, client templates, timers, framework render).

---

## 2. Hard safety rules (all Luna sessions)

1. **Observe only** — read already-rendered DOM and page JS; do not play the game for the user.
2. **Forbidden:**
   - Clicking Join Shift / Collect Prize / Cancel / Send Petpet / any gameplay control
   - `fetch` / XHR / WebSocket **initiated by the extension or agent** to Neopets
   - Auto-refresh, auto-navigation, form submit, `location.reload`
   - Injecting cheats or rewriting game outcomes
3. **Allowed:**
   - Read-only DevTools inspection
   - Read-only `evaluate` to dump function names, hook **page-owned** XHR/fetch **observers** (log only), snapshot DOM
   - User manually performs Join / Send / etc.
4. Do not expand `manifest` permissions (`tabs`, `scripting`, broad hosts) during diagnosis unless owner explicitly approves later for a reviewed fix.
5. No publish / push / Web Store work in this task.

---

## 3. Two-phase workflow

### Phase A — Offline / quiet JS analysis (now or anytime)

**When:** Owner is on Hospital or GD pages in a stable state (available or active). No need to wait for a “bug moment.”

**Objectives:**

1. Map how the page updates UI without navigation.
2. Identify signals we could legally observe later (DOM mutation roots, XHR URL patterns, global functions).
3. Compare to fixtures under `tests/fixtures/hospital-volunteer/` and `tests/fixtures/grave-danger/`.

**Deliverable:** Section 7 filled in this file (or a short addendum `12a-…-findings.md`).

### Phase B — Live incident capture (when owner hits the bug)

**When:** Owner is about to:

- Start a new Hospital shift **without** refreshing, and/or  
- Start Grave Danger and wait for remaining text  

**Objectives:**

1. Timeline from user action → network → DOM change → what our content script did (or failed to do).
2. Confirm whether Expellibox-style local polling / MutationObserver-on-root / single post-idle poll would have caught it.
3. Capture redacted DOM before/after and any `json_request` / XHR paths.

**Deliverable:** Section 8 timeline + recommended fix option (still no implement unless owner says go).

---

## 4. Current extension behavior (baseline)

| File | Behavior |
| --- | --- |
| `src/content/observe.ts` | Runs once at `document_idle` per navigation |
| Hospital | `parseHospital` once → `ACTIVITY_OBSERVED` + `replaceScope` |
| Grave Danger | `parseGraveDanger` + **one** 800ms retry if shell present but remaining empty |
| Expellibox | Local DOM poll every 1s up to ~3 min or until classified / pagehide |
| Service worker | Does not watch tabs; only message-driven |

**Implication:** Any in-page update after the content script finishes is invisible until reload — unless we add a **bounded, local** re-observe path.

---

## 5. Phase A checklist — JavaScript / architecture analysis

### 5.1 Hospital Volunteer

On `volunteer.phtml` (user already logged in):

1. **Script inventory**
   - List external scripts and inline scripts related to volunteer / `vc-` / fight / shift.
   - Note globals: e.g. `vcClock`, `json_request`, jQuery, custom namespaces.

2. **DOM roots that change on shift start**
   - Confirm cards still use `.vc-fight-details` (fixture vs live).
   - Identify parent container that is replaced or mutated when a pet starts volunteering.
   - Note whether **entire card list** is re-rendered or a single card is patched.

3. **Network (passive)**
   - DevTools Network: filter XHR/fetch while **user** clicks Join (owner clicks; Luna only watches).
   - Record:
     - URL path (no cookies/tokens)
     - Method
     - Whether response is HTML fragment vs JSON
     - Whether success handler sets `innerHTML` / rebuilds nodes

4. **Clock behavior**
   - How `.vc-fight-time` is updated (`vcClock`, intervals).
   - Confirm inline `<script>` still nests under `.vc-fight-time` (prior bug).
   - Whether starting a shift **injects** a new clock script (would need re-parse of digit spans only).

5. **Navigation**
   - Confirm Join does **not** change `location.href` / history in a way that re-injects content scripts.
   - Check `pageshow` / `popstate` / soft navigations.

6. **Hook sketch (read-only logging, optional)**  
   If safe and temporary in DevTools console only (not shipped):

   ```js
   // EXAMPLE ONLY — diagnostic console, do not ship
   // Wrap page fetch/XHR to log URL + timestamp when user acts
   ```

   Prefer DevTools Network + Performance over permanent hooks.

### 5.2 Grave Danger

On gravedanger index:

1. **Script inventory** for adventure start / remaining timer (`#gdRemaining`, `#gdTime`, `#gdActive`, `#gdAdventure`).
2. **After user starts** (owner clicks): does remaining appear via:
   - delayed text fill into existing `#gdRemaining`?
   - full section swap?
   - countdown JS writing text every second?
3. **Timing:** ms from click → first non-empty `#gdRemaining` text.
4. Whether initial page load (already active) still needs >800ms (compare to prior GD diagnosis).
5. Whether **start** is same-document (no navigation) — if yes, same SPA class as Hospital.

### 5.3 Classification matrix (fill in Phase A)

| Mechanism | Hospital? | GD? | Extension-safe countermeasure |
| --- | --- | --- | --- |
| Full navigation | Initial load only; Join / Cancel / Complete are same-document | **Yes on Send**: `#gdForm.submit()` POSTs to the same URL in the same tab | Content script re-runs; retain a bounded first-stable-read path for GD |
| XHR + `innerHTML` replace | **Yes, but JSON response + targeted single-card patch**, not a whole-list replacement | No gameplay XHR observed in the active page; Send is a form POST | Hospital: re-parse after a structural/class mutation under `#VolunteerFightInfo` |
| In-place text update | **Yes**: six clock digit spans tick every second; card status/button/service nodes also change in place | **Yes**: `GDActive.timer` writes `#gdRemaining` every second | Ignore pure Hospital digit ticks; for GD, stop observing after the first parseable remaining value |
| Client timer only (no server remaining) | `vcClock` receives response/server-rendered remaining data, then counts down locally | `GDActive.target` is server-rendered; remaining text is derived locally | Snapshot on first stable read; never treat the ticking DOM as a server-live guarantee |
| Shadow DOM / canvas | No | No | Normal DOM selectors remain usable |

---

## 6. Phase B checklist — live incident session

### 6.1 Setup (before owner acts)

1. Load unpacked extension from `dist/` (latest build); Reload extension.
2. Open Hospital or GD tab; open DevTools on **page** + **service worker**.
3. Clear or note current popup reminders.
4. Start a simple timeline log (timestamps relative to `performance.now()` or wall clock).

### 6.2 Hospital script (owner-driven)

1. **T0** — Page stable; Luna snapshots:
   - count `.vc-fight-details`
   - how many active / available / ready (by button/status text)
   - whether content script already sent observations (SW log)
2. Owner clicks **Join Shift** on one card (Luna does not click).
3. Luna records every ~200–500ms for up to ~15s (or until UI stable):
   - active card count
   - presence of `Time Remaining` + pet name + clock digits
   - `location.href` unchanged?
   - new XHR paths completed?
4. **T_stable** — First moment parser **would** emit active if run now (`parseHospital` mental model or evaluate pure parse if test harness available).
5. Confirm extension popup **did not** update without reload.
6. Owner optionally reloads once → confirm extension then catches state (control).

### 6.3 Grave Danger script (owner-driven)

1. **T0** — Before start (or mid-flow as available).
2. Owner starts expedition.
3. Log:
   - `#gdRemaining` text empty → first parseable duration
   - delay ms
   - whether 800ms retry alone would have been enough
4. If already active on load: measure remaining fill delay from navigationStart (regression vs old diagnosis).

### 6.4 What to capture (redacted)

- Small HTML snippets of **one** card / GD timer region before & after (synthetic names OK).
- XHR path list (no bodies if they contain account data).
- Console lines from `[neopets-reminders]`.
- SW: any `ACTIVITY_OBSERVED` / rejects.
- Conclusion: “content script idle finished at T_idle; DOM became parseable at T_dom; gap = …”

---

## 7. Phase A findings (Luna fills in)

### Hospital

| Field | Finding |
| --- | --- |
| Date | Phase A: 2026-08-12; live lifecycle timing: 2026-08-13 |
| Final URL | `https://www.neopets.com/hospital/volunteer.phtml` |
| Globals / key functions | Page asset `https://images.neopets.com/hospital/volunteer.js?v=20260507`; `startShift`, `setFightInService`, `clearFightInService`, `cancelShift`, `setVolunteerFinished`, `completeShift`, `collectAllRewards`, `vcClock`, and the `intervals` clock registry. |
| DOM root that mutates | Stable common root: `#VolunteerFightInfo` (`.vc-acts`). It contains Act panes → `.vc-fights` → individual `.vc-fight#VolunteerFight{fight}` cards. Join / Cancel / Complete patch **one card**, rather than rebuilding the whole list. |
| XHR/fetch paths on Join (paths only) | `POST /np-templates/ajax/plots/hospital/volunteer-join.php`. Related same-document actions use `volunteer-cancel.php`, `volunteer-finish.php`, and `volunteer-missed.php`. |
| Response type (HTML/JSON) | JSON. The success handler immediately patches DOM from response fields. |
| `location` changes? | **No on Join.** Reload/navigation lines in `startShift` are commented out. Cancel and Complete are also fetch + in-place patch flows. |
| Clock injection notes | Server-rendered active cards contain six digit spans plus one inline initializer script. A newly joined card reuses the six spans already present in the available card, constructs `vcClock(data.time / 3600, 0, 0)`, and starts a 1-second interval; it does **not** inject another inline clock script. At zero, `setVolunteerFinished` changes the card class/button in place. |
| Fixture drift vs `tests/fixtures/hospital-volunteer/` | The parser-facing inner structure still matches: `.vc-fight-details`, `.vc-status`, `.vc-fight-time`, `.vc-fight-service`, and `.vc-pet-name`. The reduced fixtures intentionally omit the useful live outer roots/classes (`#VolunteerFightInfo`, `.vc-fight.open/serving/finished`) and runtime handlers/scripts. No selector-breaking drift found. |
| Earliest reliable re-parse signal | After Join JSON success, synchronous `.vc-fight` class transition `open` → `serving` plus insertion of `.vc-fight-service` under `#VolunteerFightInfo`. For finish/clear, use `serving` → `finished` or service-node removal. Observe structural/class changes, debounce once, re-run the full Hospital parse with `replaceScope: true`, and ignore pure `.vc-fight-time` digit mutations. |

### Grave Danger

| Field | Finding |
| --- | --- |
| Date | Phase A: 2026-08-12; live lifecycle timing: 2026-08-13 |
| Final URL | `https://www.neopets.com/halloween/gravedanger/` |
| Globals / key functions | Inline `GD` object (`GD.ui.selectPetpet`, `GD.sendPetpet`, `GD.equip`) and inline `GDActive.timer`; jQuery is used. No dedicated Grave Danger gameplay JS asset was loaded. |
| Remaining node fill mechanism | The server renders `GDActive.target` (epoch seconds). On document ready, the page starts `setInterval(GDActive.timer, 1000)`; each tick derives hours/minutes/seconds and calls `$('#gdRemaining').text(str)`. It does not call the timer immediately. At zero it runs `location.href = location.href`. |
| Delay click → parseable remaining | Final Send was live-monitored on 2026-08-13. It submitted a new document; exact owner click wall time was not independently marked, so use the new-document timings below rather than claiming click latency. |
| Delay navigation → parseable remaining | **Measured:** active shell plus an initially unparseable `#gdRemaining` appeared at ~1666ms from the new document time origin; load completed at ~1977ms; first parseable remaining appeared at ~2718ms. |
| Is 800ms retry enough on load? | **It succeeded in this run by only ~59ms.** The initial content-script failure logged at ~1977ms, putting its 800ms retry near ~2777ms; the first parseable value appeared at ~2718ms. This margin is too small to treat 800ms as robust under normal scheduling/background variance. |
| Same-document start? | **No.** `GD.sendPetpet` fills hidden fields and calls `#gdForm.submit()`; the form is `POST` to the same canonical URL with no alternate target, producing a full navigation. |
| Fixture drift vs `tests/fixtures/grave-danger/` | Active selectors/shape still match. On 2026-08-13, real returned/end and available/selection states were also observed: end has `#gdReward` plus a POST `.gdForm` containing `Adventure again!`; selection has `#gdSelection` plus POST `#gdForm`. Sanitized fixture files have not yet been created for those states, and no-petpet remains uncaptured. |

### Shared notes

- Read-only 2.2-second samples confirmed both pages continuously mutate timer text: Hospital digit spans decreased by 2 seconds and GD remaining text decreased by 3 seconds. A broad `characterData` observer would therefore thrash.
- Hospital is the true same-document lifecycle bug: Join, zero→finished, Cancel, Complete, and Collect All can all change reminder-relevant state without reinjecting the content script.
- GD is a new-document first-stable-read race, not the same SPA class. A long-lived post-action observer is unnecessary there; prefer a very narrow bounded wait for the first parseable `#gdRemaining`, then disconnect/stop.
- Evidence-based recommendation: **Hospital Option B/C** — filtered `MutationObserver` on `#VolunteerFightInfo` structural/class changes, debounced full re-parse, with a short bounded fallback only if the root is initially missing. **GD narrow C** — strictly classify active/end/selection documents; on active, wait on `#gdRemaining` until first parseable text with a short hard timeout, then stop before its 1-second countdown can cause repeated sends.
- This pass did not click gameplay controls, reload, navigate, submit forms, install network hooks, or persist account names/identifiers.

---

## 8. Phase B live timeline (Luna fills in)

### 8.1 Hospital completed checkpoint — 2026-08-13 (partial Phase B)

This capture began **after** both shifts had completed and before the owner
clicked Collect Prize. It proves the current ready DOM and parser signal, but
does not measure the earlier active → finished transition.

| Field | Value |
| --- | --- |
| Date / local time | 2026-08-13, approximately 01:00 SGT |
| Activity | Hospital |
| Extension build | Loaded content script present; exact `dist` reload time not established |
| Browser | Chrome, existing authenticated owner tab |
| Navigation age at first snapshot | Approximately 81 seconds; navigation type `navigate` |
| Safety | Read only; no reload, Collect, Cancel, Join, form submit, or gameplay request |

| t | Event | DOM summary | Extension log |
| --- | --- | --- | --- |
| Snapshot | Owner reports both shifts already complete | 26 `.vc-fight-details`: 2 `.vc-fight.finished`, 12 `.vc-fight.open`, 12 locked/empty. Finished cards have `Time Remaining:`, six digits `000000`, `.vc-fight-service`, a pet-name node, and `Collect Prize`. No `.vc-fight.serving` remains. | No `[neopets-reminders]` diagnostic lines. Successful observations are silent, so this is not evidence of a missed send. |
| +2.2 s | Stability re-read | Both finished-card signatures were unchanged; no timer or structural mutation continued. | No new diagnostic line. |

Answers for this checkpoint:

1. **Did the content script run only once at idle?** The code still has one
   `document_idle` entry per navigation. This page was freshly navigated into a
   server-rendered ready state; the successful send path is silent, so page
   logs alone cannot prove message delivery.
2. **Gap between user action and parseable DOM?** Not measurable in this
   capture: the page was already ready before observation began.
3. **Would a 1-second local poll catch it?** Yes, the ready DOM remained stable
   and immediately parseable, although an unbounded poll is unnecessary.
4. **Would a MutationObserver be enough?** Phase A code evidence says a
   filtered observer on `#VolunteerFightInfo` would see the earlier card class /
   button changes. That transition was not directly witnessed here.
5. **False-positive risk?** Active clock spans tick every second, so a broad
   observer would thrash. The completed state itself is stable. Filter for
   `.vc-fight` class changes and service/button structural mutations.

Parser conclusion: both live finished cards match the current ready branch
directly because `Collect Prize` is visible. The `000000` clock is also a safe
secondary ready signal if that button text changes in a future page revision.

### 8.2 Hospital single-Collect transitions — 2026-08-13

The owner collected the two completed shifts individually. The observer did not
click, close popups, submit forms, read reward contents, or retain pet/account
data.

| Local time (SGT) | Event | Network | DOM result |
| --- | --- | --- | --- |
| Before 01:02 | Starting checkpoint | — | Two `.vc-fight.finished` cards, both `Collect Prize`, `000000`, and service nodes present. |
| 01:02:33–01:02:34 | Owner collected the first finished card | `POST /np-templates/ajax/plots/hospital/volunteer-finish.php`; fetch duration approximately 944ms | No navigation. `VolunteerFight3` became `.vc-fight.open`; button became `Join Shift`; status became `Volunteer Time Needed:`; digits reset to `030000`; service and pet-name nodes were removed. `VolunteerFinishPopup` displayed. The second card remained finished. |
| 01:04:49–01:04:50 | Owner collected the second finished card | Same `POST` path; HTTP 200; duration approximately 1058ms | No navigation. `VolunteerFight4` received the same in-place reset. Finished count became 0, open count became 14, and the finish popup displayed again. |
| 01:06:26 + 2.2s | Final stability sample | No further Hospital request | Both target cards remained `open / Join Shift / 030000`; no service or pet-name nodes returned. URL stayed canonical. |

The page console contained no new `[neopets-reminders]` diagnostics during the
two actions. This is expected for the existing one-shot content script: the
fetches and card mutations do not navigate the document, so `document_idle`
does not run again. Successful observation sends are silent, and the protected
extension popup/storage could not be inspected through the browser-control
surface; stale-reminder UI confirmation remains an owner-visible check.

This directly confirms the Hospital re-observation requirement:

- The mutation scope can be limited to `#VolunteerFightInfo`.
- Each Collect changes one `.vc-fight` class plus button/status/service content;
  no whole-list replacement occurs.
- Debounced re-parse **after the first Collect** would emit the one remaining
  ready card and `replaceScope: true` would remove the first stale reminder.
- Debounced re-parse **after the second Collect** would emit an empty Hospital
  set; `replaceScope: true` is required to clear the final stale reminder.
- Pure clock-span text mutations must remain filtered out.

Phase B Hospital recommendation: **Option B**, a filtered/debounced
`MutationObserver` on `#VolunteerFightInfo`, with a short bounded root-discovery
fallback only when that root is missing at initial observe. No persistent
Hospital poll or page-network hook is needed based on this capture.

### 8.3 Hospital individual Join transitions — 2026-08-13

After both completed shifts were collected, the owner assigned pets to the two
open slots individually. The observer did not click, select pets, confirm Join,
read names/hidden values, or inspect response bodies.

| Local time (SGT) | Event | Network | DOM result |
| --- | --- | --- | --- |
| 01:13:41 | Owner opened the first slot's pet-selection flow | `POST /np-templates/ajax/plots/hospital/get-pets.php`; approximately 915ms | Pet-selection UI was populated by page-owned JS. |
| 01:13:47 | Owner confirmed the first Join | `POST /np-templates/ajax/plots/hospital/volunteer-join.php`; HTTP 200; approximately 840ms | No navigation. `VolunteerFight3` became `.vc-fight.serving`; button became `Cancel`; status became `Time Remaining:`; one service/pet-name structure was inserted. `VolunteerJoinedPopup` displayed. |
| +2.2s sample | First client clock check | No additional Hospital request | Newly created clock decreased by 3 seconds. No inline clock script was injected; the page-owned success handler started the interval. |
| 01:17:34 | Owner opened the second slot's pet-selection flow | One `get-pets.php`; approximately 1084ms | Same page-owned selection flow. |
| 01:17:35 and 01:17:38 | Owner confirmed the second Join flow | Two `volunteer-join.php` resource entries, approximately 903ms and 854ms; both HTTP 200; starts separated by about 3.35s | Final visible result was one new serving card only: `VolunteerFight4` had exactly one service node, one pet-name node, and one Cancel button. No error popup remained. Response bodies were deliberately not inspected, so the extra request remains an unclassified duplicate/business-result request. |
| Final +2.2s sample | Both active clocks checked | No additional Hospital request | Both clocks independently decreased by 2 seconds. Final counts: 2 serving, 12 open, 0 finished; URL and navigation time origin remained unchanged. |

The available → active path is now live-confirmed:

- `get-pets.php` populates the selection UI, then `volunteer-join.php` returns
  the data used by `setFightInService`.
- The success handler synchronously patches one existing `.vc-fight` under
  `#VolunteerFightInfo`; it does not replace the whole act/list and does not
  navigate.
- A newly joined card reuses its existing six digit spans. The handler creates
  `vcClock(data.time / 3600, 0, 0)` and starts a 1-second interval without
  inserting an inline script.
- A filtered observer should react once to the card class/service/button
  structural transition, debounce, parse both active cards, and send
  `replaceScope: true`. It must ignore all later digit-span writes.
- The observed duplicate Join request reinforces that the extension must
  deduplicate by the parsed Hospital snapshot, never by request count. It does
  **not** justify hooking or replaying page requests.

Together with §8.2, Hospital Phase B now covers both directions:
`ready → available` after individual Collect and `available → active` after
individual Join. The evidence supports the same final design: filtered Option B
on `#VolunteerFightInfo`, with snapshot deduplication and scope replacement.

### 8.4 JavaScript lifecycle summary for extension implementation

The two pages should **not** share one generic permanent polling strategy. Their
JavaScript lifecycles are materially different.

#### Hospital: one document, authoritative card-state lifecycle

Hospital's page asset is
`https://images.neopets.com/hospital/volunteer.js?v=20260507`. The relevant
per-card state machine is:

```text
.vc-fight.open
  -- startShift / volunteer-join.php --> .vc-fight.serving
  -- cancelShift / volunteer-cancel.php --> .vc-fight.open

.vc-fight.serving
  -- vcClock reaches zero / setVolunteerFinished --> .vc-fight.finished
  -- cancelShift / volunteer-cancel.php --> .vc-fight.open

.vc-fight.finished
  -- completeShift / volunteer-finish.php --> .vc-fight.open
```

No transition above performs a document navigation:

1. **Join (`open → serving`)**
   - `startShift(e)` posts `fight_id` and `pet_name` to
     `volunteer-join.php` and reads JSON.
   - On success it calls `setFightInService(fight, data)`.
   - That function changes the existing card class, appends one
     `.vc-fight-service`, inserts the pet-name node, changes the button to
     `Cancel`, and changes `.vc-status` to `Time Remaining:`.
   - The six clock digit spans already exist on the open card. The handler
     constructs `vcClock(data.time / 3600, 0, 0)` and starts a 1-second
     interval; it does not inject a new script element.
2. **Timer completion (`serving → finished`)**
   - `vcClock.tick('fight', fight)` updates the six digit spans every second.
   - At zero it calls `setVolunteerFinished(fight)`, which changes the card
     class and, in the inspected client asset, changes the button to
     `Complete`. By contrast, the freshly navigated server-rendered finished
     state observed in §8.1 used `Collect Prize`.
   - This is a client-only reminder-relevant transition; there is no fetch and
     no content-script reinjection.
   - Static source caveat: the optional Skip-button block inside
     `setVolunteerFinished(fightID)` refers to `fight` rather than `fightID`.
     The active → finished instant was not captured live, so this is recorded
     only as a possible page-script exception/repeat-update risk, not as a
     reproduced defect. The extension should still deduplicate identical
     finished snapshots.
3. **Individual Collect (`finished → open`)**
   - `completeShift(e)` posts the volunteer id to `volunteer-finish.php` and
     reads JSON.
   - On success it shows the reward popup and calls
     `clearFightInService(data.fight, data.time)`.
   - That function removes `.vc-fight-service`, changes the button to
     `Join Shift`, changes the status to `Volunteer Time Needed:`, clears the
     old interval, and resets the visible digit spans with `vcClock.display`.
4. **Cancel (`serving → open`)**
   - `cancelShift(e)` posts to `volunteer-cancel.php`; its success path calls
     the same `clearFightInService` function.
5. **Collect All**
   - `collectAllRewards(e)` posts to `volunteer-missed.php` and loops over
     `data.fights`, calling `clearFightInService` for each card. Although not
     used in this live session, one debounced full-page re-parse also covers it.

The extension-safe implementation shape is therefore:

```text
document_idle
  -> find #VolunteerFightInfo
  -> attach filtered observer before/around initial authoritative parse
  -> parseHospital(document, observedAt)
  -> send Hospital snapshot with replaceScope: true

relevant structural/class mutation
  -> debounce approximately 300–500ms
  -> re-parse the whole Hospital document, not only the mutated card
  -> compare/deduplicate the parsed snapshot
  -> send with replaceScope: true, including an empty snapshot

pagehide
  -> disconnect observer and clear pending debounce
```

Recommended observer scope and filter:

- Root: `#VolunteerFightInfo` (`.vc-acts`).
- Observe `childList + subtree` and `.vc-fight` `class` changes.
- Treat insertion/removal of `.vc-fight-service`, pet-name/button structures,
  and `.vc-fight` transitions among `open`, `serving`, and `finished` as
  relevant.
- Do not depend on one ready-button label. Client-zero code says `Complete`,
  while the observed server-rendered state says `Collect Prize`; the finished
  class, zero clock, service structure, and strict parser result together are
  more reliable.
- Ignore mutations whose effective target is only inside `.vc-fight-time`.
  Those six spans write every second and would otherwise cause parse/message
  thrash.
- Coalesce the many synchronous mutations produced by one page function into
  one re-parse.
- Parse **all slots** after every relevant transition. Do not map network
  request count to reminders; the live second Join produced an extra HTTP-200
  request but only one visible serving card.
- Use `replaceScope: true` even when the parsed Hospital list is empty. This is
  what clears the final ready reminder after the last individual Collect.
- If `#VolunteerFightInfo` is absent at `document_idle`, use only a short,
  bounded root-discovery fallback, then fail safe. Do not add page fetches,
  reloads, clicks, or an unbounded document-wide observer.

This observer recognizes the lifecycle changes that the current one-shot
content script misses while preserving the extension's core rule: the page
owns all gameplay and network actions; the extension only re-reads local DOM.

Hospital acceptance cases for the future implementation:

1. From two open cards, owner-driven Join on slot 1 updates storage/popup to one
   active Hospital reminder without navigation or reload.
2. Owner-driven Join on slot 2 produces two active reminders. Multiple DOM
   mutations—or the observed extra page request—must not create duplicates.
3. Ordinary 1-second digit-span ticks produce no new observation message.
4. A card changing `serving → finished` at `000000` becomes ready without a
   reload. Test both the client label `Complete` and the server-rendered label
   `Collect Prize`; do not weaken duration parsing.
5. Collecting one of two ready cards re-parses the full document and removes
   only that card's stale reminder.
6. Collecting the final ready card sends an empty Hospital snapshot with
   `replaceScope: true`, clearing the final stale reminder.
7. A burst of synchronous class/child mutations from one page function results
   in one debounced parse/send; `pagehide` cancels pending work.

#### Grave Danger: three navigation-bound documents plus one delayed first write

Grave Danger is **not** the same same-document lifecycle as Hospital. The live
2026-08-13 sequence exposed three distinct documents at the same canonical URL:

```text
active document
  -- countdown zero / location.href reload --> returned/end document

returned/end document (#gdReward)
  -- POST Adventure again --> available/selection document (#gdSelection)

available/selection document
  -- GD.sendPetpet / POST #gdForm --> active document (#gdAdventure)
```

1. The returned/end document has `#gdReward`, no `#gdAdventure`, `#gdActive`,
   `#gdTime`, `#gdRemaining`, or `#gdSelection`, and a normal POST `.gdForm`
   with a hidden `again` field and `Adventure again!` submit button.
2. Adventure Again creates a new available/selection document. Its stable
   markers are `#gdSelection` and POST `#gdForm`; it has no active/remaining
   markers.
3. `GD.sendPetpet()` copies the user's selection into the existing form and
   calls `#gdForm.submit()`. That POST creates the new active document.
4. On an active result document, the server supplies `GDActive.target` as epoch
   seconds. `$(document).ready(...)` starts
   `setInterval(GDActive.timer, 1000)` but does **not** call the timer once
   immediately.
5. The first interval tick computes the remaining duration and writes
   `#gdRemaining` with `$('#gdRemaining').text(str)`. Later ticks rewrite that
   text every second.
6. At zero the page executes `location.href = location.href`, causing another
   full navigation.

Consequences for the extension:

- GD needs a **bounded first-parseable-value wait after each navigation**, not
  a permanent post-action observer.
- Run `parseGraveDanger` immediately. If the active shell exists but
  `#gdRemaining` is empty/unparseable, observe that one node or poll local DOM
  briefly until the first parseable value, then send once and disconnect/stop.
- Live Send timing was: shell/unparseable remaining at ~1666ms, initial content
  parse failure and load completion at ~1977ms, and first parseable value at
  ~2718ms. The current 800ms retry therefore ran near ~2777ms and succeeded by
  only ~59ms. The hard timeout must cover this measured path plus reasonable
  scheduling/background variance.
- Implementation recommendation: after the immediate active parse fails, use a
  temporary `MutationObserver` on the existing `#gdRemaining` with
  `childList + characterData + subtree`, and a **5-second hard timeout from the
  failed parse**. Five seconds covers several nominal 1-second page ticks and
  is materially safer than the measured 59ms retry margin while remaining
  bounded. If the remaining node itself is initially missing, observe only the
  active shell until it appears, under the same deadline.
- Once a value is parseable, do not react to its subsequent 1-second text
  writes. The stored reminder remains `observedAt + parsed remaining`.
- Send, Adventure Again, and zero already navigate, so they should not be
  bridged by a long-lived observer or page-network hook.
- The end and selection documents are now live-observed state signals. After
  creating sanitized fixtures and strict classification tests, either document
  should reconcile Grave Danger with an **empty snapshot plus
  `replaceScope: true`**, clearing the stale active reminder. The current parser
  only logs `active-markers-missing` and returns without sending, so old active
  state survives both navigations.
- No-petpet markup is still uncaptured and must remain unsupported rather than
  inferred from the selection page.

Grave Danger acceptance cases for the future implementation:

1. If `#gdRemaining` is parseable immediately, send once and arm no retry.
2. If the active shell exists with empty/unparseable remaining, a later
   page-owned text write becomes parseable within the bounded window and sends
   exactly once.
3. Subsequent 1-second countdown writes produce no additional messages.
4. Timeout or `pagehide` disconnects/stops the temporary wait without a guessed
   reminder.
5. A full Send/zero navigation relies on normal content-script reinjection;
   the extension must not simulate or hook that navigation.
6. A genuine `#gdReward` end fixture and genuine `#gdSelection + #gdForm`
   selection fixture classify strictly as inactive/empty scope and clear the
   old active reminder with `replaceScope: true`.
7. Missing markers that match neither a captured active, end, nor selection
   fixture remain unknown and must **not** clear scope.

#### Shared extension invariants

- Re-observation is triggered only by page-owned navigation or page-owned DOM
  changes; it never initiates Neopets requests or gameplay actions.
- Each parse produces a scope-level snapshot. Storage reconciliation follows
  parsed DOM state, not click/request counts.
- Debounce/deduplicate before sending so page functions and client clocks do
  not bump reminder generations repeatedly.
- Stop all temporary observers/timers on `pagehide` and after terminal success
  or timeout.
- Keep parser strictness and fixture gates unchanged; re-observation must not
  turn unknown markup into a guessed reminder state.

### 8.5 Grave Danger end → selection → active timeline — 2026-08-13

The owner performed all Adventure Again, Petpet selection, confirmation, and
Send actions. The observer did not click, submit, read hidden values, retain
names/rewards, or inspect request/response bodies.

| Stage | Page-owned behavior | Live DOM / timing | Current extension behavior |
| --- | --- | --- | --- |
| Returned/end | Server-rendered document at the canonical URL | `#gdReward` present; no active/remaining/selection markers. `Adventure again!` is a normal POST submit in `.gdForm`. | Content script logs `active-markers-missing` and sends no replacement snapshot, so a prior active reminder can remain stale. |
| Adventure Again | Owner submits the POST form | New navigation time origin confirmed; selection document loads at the same canonical URL. | Normal content-script reinjection occurs, but markers are still unsupported. |
| Available/selection | Server-rendered selection document | `#gdSelection` and POST `#gdForm` present; no `#gdAdventure`, `#gdActive`, or `#gdRemaining`. | Again logs `active-markers-missing` and does not clear the prior scope. |
| Final Send | `GD.sendPetpet()` submits `#gdForm` | New active document time origin confirmed. | Normal reinjection occurs. |
| +~1666ms from new document | Server active DOM becomes visible | `#gdAdventure`, `#gdActive`, `#gdTime`, and `#gdRemaining` exist, but trimmed remaining length was only 3 and unparseable. | No valid observation yet. |
| +~1977ms | Document load / `document_idle` observation | Active shell remains; remaining still unparseable. | Logged `skip-unparseable-gd-remaining`; schedules one 800ms retry. |
| +~2718ms | First page-owned timer write becomes parseable | `#gdRemaining` becomes a normal duration string. This was ~1052ms after shell appearance and ~741ms after load/initial failure. | Retry is due near ~2777ms, so this run succeeds silently by only ~59ms. |
| Later 2.2s sample | Page interval continues | Parsed remaining decreased by 3 seconds. | No new diagnostics; a permanent observer must not resend on these ticks. |

Direct conclusions:

- Grave Danger does **not** need a same-document lifecycle observer like
  Hospital; every major state change observed here creates a new document.
- It does need strict recognition of the two non-active documents so normal
  reinjection can clear stale scope after completion and during selection.
- The active document needs a bounded first-value wait. A single 800ms retry
  worked in this run, but the measured ~59ms margin is not an adequate safety
  margin.
- A temporary observer on `#gdRemaining` can stop at the first strict
  parse success. If a bounded local poll is preferred for testability, it must
  have the same one-success, timeout, and `pagehide` stop conditions.
- Sanitized end and selection fixtures are the next gate before changing the
  parser's inactive classification. The live evidence is real, but the fixture
  files have not yet been added in this diagnostic-only task.

### 8.6 Remaining live-transition template

### Incident meta

| Field | Value |
| --- | --- |
| Date / NST approx | |
| Activity | Hospital / GD / both |
| Extension build | `dist` reload time |
| Browser | |

### Timeline table

| t (s) | Event | DOM summary | Extension log |
| --- | --- | --- | --- |
| 0.0 | | | |
| … | User action | | |
| … | XHR complete | | |
| … | Parseable state | | |

### Answers

1. Did content script run only once at idle?  
2. Gap (ms) between user action and parseable DOM?  
3. Would Expellibox-style local poll (1s) have caught it?  
4. Would a MutationObserver on container X be enough (name the container)?  
5. Any false-positive risk (clock tick every second causing spam)?  

---

## 9. Candidate fixes (design only — rank after evidence)

Prefer **local DOM only**, stop conditions, no Neopets requests from the extension.

Evidence-based selection after the current Phase A/B work:

| Page | Selected shape | Reason |
| --- | --- | --- |
| Hospital | **Option B**, filtered/debounced observer on `#VolunteerFightInfo`, plus only a bounded root-discovery fallback | Join, zero, Cancel, and Collect are same-document card mutations. Permanent polling would waste work; network hooks are unnecessary. |
| Grave Danger | **Narrow Option C**, strict active/end/selection document classification plus immediate active parse and a temporary first-parseable wait on `#gdRemaining`, then disconnect | Every lifecycle action navigates normally. Non-active documents must clear stale scope; only the first active countdown write races `document_idle`. A permanent observer would react every second. |

| Option | Idea | Pros | Cons |
| --- | --- | --- | --- |
| **A. Bounded local poll** | Like Expellibox: every 1s re-`parseHospital` / `parseGraveDanger` while tab open, max N minutes | Simple; handles late XHR + post-click | Wakeups while tab open; must debounce identical snapshots |
| **B. MutationObserver** | Hospital: observe filtered structure/class changes under `#VolunteerFightInfo`; GD: at most a temporary first-value observer on `#gdRemaining` | Event-driven; less idle work | Hospital requires clock-mutation filtering; GD observer must disconnect after first parseable value |
| **C. Hybrid** | Page-specific immediate parse plus a short bounded fallback only for missing root/first value | Robust against delayed initial rendering | Slightly more code and explicit stop-state tests |
| **D. Hook page XHR** | Monkey-patch after load | Precise | Fragile; policy/optics worse; easy to over-reach — **discouraged for production** |
| **E. User gesture bridge** | Re-parse only on `visibilitychange` / popup open | Low overhead | Still misses if user never blurs tab |

**Hospital-specific requirements for any fix:**

- Re-run full-page parse + **`replaceScope: true`** so ready→active and collected→gone clear stale rows.
- Ignore pure clock-digit ticks if possible (generation thrash); only treat as update when status/pet/button set changes **or** dueAt shifts beyond tolerance.
- Do not click Join/Collect.

**GD-specific:**

- Keep snapshot semantics (`observedAt + duration`).
- If remaining ticks every second in DOM, do **not** bump generation each second — only first stable read or material duration change (>60s policy already exists in generation helper).

**Explicitly out of scope unless revisited:**

- Background tab fetching volunteer/GD APIs  
- `alarms` that open Neopets pages  
- Reading `chrome.tabs` continuously without permission change  

---

## 10. Prompt for Luna — Phase A (JS analysis)

Copy-paste:

```text
你在仓库 `/Users/cusgadmin/neopets-extension` 执行 `12-hospital-gd-spa-reobserve-diagnostic.md` 的 **Phase A**。

目标：分析 Hospital Volunteer 与 Grave Danger 页面如何在不整页导航的情况下更新 DOM，并填写文档第 7 节。

硬性安全：observe-only；禁止代点 Join/Collect/Send；禁止扩展侧 fetch/XHR/刷新；不要改 src 业务逻辑；不要 push。

步骤：
1. 阅读 12-hospital-gd-spa-reobserve-diagnostic.md 与 src/content/observe.ts、hospital/grave-danger parsers。
2. 用户手动打开 hospital volunteer 与 gravedanger 页面。
3. 只读分析脚本、全局函数、可能的 json_request/XHR 模式、会 mutation 的 DOM 根。
4. 若用户愿意手动点一次 Join 或 Start，你只记录 Network + DOM 前后差异（你不点击）。
5. 将发现写入 12 文档第 7 节或新建 12a-phase-a-findings.md。
6. 给出候选修复 A/B/C 的倾向（仍不实现）。
```

---

## 11. Prompt for Luna — Phase B (live incident)

Copy-paste when owner is ready to reproduce:

```text
你在仓库 `/Users/cusgadmin/neopets-extension` 执行 `12-hospital-gd-spa-reobserve-diagnostic.md` 的 **Phase B**。

场景：用户即将在 Hospital 上给宠物开新 shift（或 GD 开始探险），过程中不整页刷新；扩展目前不会更新，直到手动刷新。

硬性安全：你不点击任何 gameplay 控件；不发起 Neopets 请求；不刷新；只读监听 DOM/Network/console/service worker。

步骤：
1. 确认 dist 扩展已 Reload；打开 page DevTools + extension service worker。
2. T0 快照 Hospital/GD 状态与现有 reminders。
3. 用户操作；你按文档 6.2/6.3 做时间线（action → XHR → DOM parseable → 扩展是否收到消息）。
4. 测量 content script 结束后到 DOM 可 parse 的 gap。
5. 填写文档第 8 节；明确推荐 Option A poll / B MutationObserver / C hybrid，以及 debounce/replaceScope 注意点。
6. 不要实现修复，除非用户明确说“按结论改代码”。
```

---

## 12. Success criteria for this diagnostic track

- [ ] Phase A explains **how** Hospital updates in-page  
- [ ] Phase B measures **when** parseable DOM appears relative to user action and content-script idle  
- [ ] GD delay characterized for load vs post-start  
- [ ] Written recommendation with stop conditions and anti-thrash rules  
- [ ] No gameplay automation introduced during diagnosis  

---

## 13. Owner notes

- Prefer fixing Hospital first if only one can be done: higher pain (must refresh after every Join).  
- Expellibox poll is a working precedent for “site async, we only re-read DOM.”  
- Any production observer must remain **best-effort** and documented as such in the popup/support matrix.

(End of playbook)
