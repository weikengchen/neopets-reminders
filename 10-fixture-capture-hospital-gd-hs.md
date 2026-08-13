# Fixture Capture Brief — Hospital Volunteer, Grave Danger, Healing Springs

**Status:** capture-only research pack  
**Does not authorize implementation** until each activity is admitted (or already whitelisted) and fixtures are owner-reviewed.  
**Safety:** observe rendered pages the human opens; never automate Neopets actions or background requests.

Related design notes:

- Training remains the active vertical slice.
- Grave Danger is **APPROVED FOR V1** in `02-feature-whitelist.md` (fixtures still required before parser).
- Healing Springs and Hospital Volunteer are **not yet on the whitelist**; fixtures may be collected for design, but production code must wait for admission.
- Neolodge / Kadoatery remain deprioritized.

---

## 0. Global capture rules

1. User manually opens the real page in a normal logged-in browser.
2. Capture **small sanitized HTML fragments** (timer/status structure only), not full account dumps.
3. Replace real pet/petpet/account names with obvious synthetics (`FixturePet01`, `FixturePetpetA`).
4. Strip cookies, tokens, NP/NC, inventory, sidebars, tracking, large image URLs.
5. Do **not** invent markup. If a state is unavailable, omit the file and document why.
6. Do **not** implement parsers, change permissions, or open feature gates in this task.
7. Record capture date, exact URL, browser note, and sanitization in each activity `README.md`.
8. Prefer **focused tab, freshly rendered** captures for any client-side countdown (see Hospital).

Directory layout:

```text
tests/fixtures/
  hospital-volunteer/
  grave-danger/
  healing-springs/
```

Each directory gets its own `README.md`.

---

## 1. Hospital Volunteer

### Known surface

| Field | Value |
| --- | --- |
| URL (expected) | `https://www.neopets.com/hospital/volunteer.phtml` |
| Activity | Plot/hospital volunteer shifts (e.g. Void Within volunteer centre) |
| Typical duration | Community guides: about **6 hours** per shift |
| Display | Page shows how much longer until the shift completes |

Confirm the live URL if redirects differ; record the final HTTPS URL actually used.

### Critical timer reliability note (owner observation)

> When the Hospital Volunteer page **loses focus** (background tab, another window), the on-page **time remaining update becomes unreliable**.

Implications for capture and future product design:

| Topic | Guidance |
| --- | --- |
| Capture | Prefer a **focused** tab. Immediately after load (or after a manual hard refresh while focused), copy the remaining-time text **once**. |
| Do not | Leave the tab backgrounded for a long time, then capture a “live” ticking value as if it were authoritative. |
| Optional evidence | If practical, capture two snapshots: (A) focused fresh load, (B) same session after ~1–2 minutes backgrounded — only to document drift; label B as `unreliable-background-note`, not as production truth. |
| Future product model | Treat displayed remaining time like Training: **snapshot at observation** → `dueAt = observedAt + parsedDuration`. Do **not** trust continuous client-side ticking while the tab is unfocused. Do **not** poll or auto-refresh the hospital page to “fix” the clock. |
| Re-observe | User may manually revisit later; a new focused load can refresh the stored deadline from a new snapshot. |

### Desired fixtures

| File | State | Notes |
| --- | --- | --- |
| `available.html` | Can join a shift / select pet | No active timer, or join UI |
| `active.html` | Pet on shift; remaining time visible | **Primary** timer fixture; focused tab |
| `ready.html` | Shift complete; claim/collect UI | If present |
| `ineligible-sick.html` | Optional: sick pet cannot volunteer | Only if visible |
| `malformed.html` | Handwritten broken timer text | Local negative test |
| `README.md` | Provenance + focus/reliability note | Required |

Also record in README:

- Exact remaining-time string(s) observed (e.g. hours/minutes format).
- Whether the countdown visibly ticks in-page while focused.
- Whether a full page reload changes the remaining value (server snapshot vs pure client timer).
- Multi-pet / multi-shift UI if shown.

### Explicitly forbidden while capturing

- Auto-click Join / Collect.
- Background refresh loops.
- Fabricating a 6-hour timer string.

---

## 2. Grave Danger

### Known surface

| Field | Value |
| --- | --- |
| URL | `https://www.neopets.com/halloween/gravedanger/index.phtml` |
| Activity | Send one Petpet into catacombs; wait for return |
| Duration | Community guides: roughly **4–10 hours** depending on Petpet |
| Whitelist | **APPROVED FOR V1** after fixtures |

### Desired fixtures

| File | State | Notes |
| --- | --- | --- |
| `available.html` | Petpet selection / can start | No expedition in progress |
| `active.html` | Expedition running; return/remaining time (or status) visible | Primary |
| `ready.html` | Returned; prize/collect state | Primary |
| `no-petpet.html` | Optional: cannot play / no petpet | If shown |
| `malformed.html` | Handwritten negative | Optional |
| `README.md` | Provenance | Required |

Capture notes:

- Preserve Petpet name structure with synthetic names; pet association only if visible and useful.
- Preserve any “time until return” / status text exactly (whitespace normalized only in notes).
- Status flavor text that changes every ~10 NST minutes is secondary; prioritize **return deadline** if shown.
- Do not capture NC equipment lists beyond what is needed for layout context.

### Forbidden

- Auto-send Petpet or auto-collect prize.
- Copying old userscript selectors into production code during this task.

---

## 3. Healing Springs

### Known surface

| Field | Value |
| --- | --- |
| URL | `https://www.neopets.com/faerieland/springs.phtml` |
| Cooldown | **~30 minutes** after a successful heal **or** shop purchase |
| Page timer | Typically **no precise remaining countdown**; cooldown is a fixed message |

### Design model to validate with fixtures (not implement yet)

```text
success observation → dueAt = observedAt + 30 minutes (authoritative)
cooldown only, no recent success in storage → estimate "within ~30 minutes" (labeled estimate)
available → no deadline / ready to use
```

### Desired fixtures

| File | State | Notes |
| --- | --- | --- |
| `available.html` | Heal my Pets / shop available | Buttons visible |
| `success-heal.html` | Result after user manually heals | One or more outcome texts OK as separate files if needed |
| `cooldown.html` | “once every thirty minutes” (or current equivalent) | Primary cooldown copy |
| `success-shop.html` | Optional: after manual shop buy | If cooldown shared |
| `malformed.html` | Optional handwritten | |
| `README.md` | Provenance + whether any remaining MM:SS exists | Required |

Capture protocol:

1. Open page → capture `available` if ready.
2. User **manually** clicks Heal once → capture **success** result HTML fragment immediately.
3. Re-open or same navigation to cooldown state → capture `cooldown`.
4. In README, explicitly answer: **Is a numeric remaining time shown? (expected: no)**

### Forbidden

- Extension or agent clicking Heal/Buy.
- Background polling springs to discover cooldown end.
- Treating cooldown-only as a precise second-level timer without labeling estimate.

---

## 4. Admission status (do not blur)

| Activity | Whitelist today | Fixture capture | Implement parser now? |
| --- | --- | --- | --- |
| Hospital Volunteer | Not listed | Allowed for research | **No** |
| Grave Danger | APPROVED FOR V1 | Required gate | **No** until fixtures reviewed |
| Healing Springs | Not listed | Allowed for research | **No** |
| Training | APPROVED FOR V1 | Ongoing | Partial only (existing work) |

---

## 5. Done criteria for the capture agent

- Directories and READMEs exist for all three activities.
- Every committed HTML file is sanitized and non-empty.
- Missing states are listed with reasons (not fabricated).
- Hospital README includes the **focus / unreliable background timer** note and how capture avoided it.
- Healing Springs README states whether remaining time text exists.
- No production parser/permission changes.
- Short Chinese or English handoff report listing files and gaps.

(End of brief)
