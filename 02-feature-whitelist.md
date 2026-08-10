# Feature Whitelist and Precedent Register

This file is a gate, not a wishlist. Coding agents must not add timers that are absent from this register.

## Status vocabulary

- **APPROVED FOR V1:** may implement now.
- **APPROVED FOR P1:** safe precedent exists, but parser/product semantics need validation first.
- **PRECEDENT ONLY:** evidence exists, but not enough to implement without a new review.
- **PROHIBITED:** outside reminder-only scope.

---

## A. Training timers — APPROVED FOR V1

### Activities

- Swashbuckling Academy
- Mystery Island Training School
- Secret Ninja Training School

### Existing precedent

**systematic-meerca — Neopets Training Timer** is listed in the r/neopets approved userscript repository. Current source handles the three schools, reads `Time till course finishes`, extracts hours/minutes/seconds, and stores `endTime = now + remaining`.

Sources:

- Approved list: https://www.reddit.com/r/neopets/wiki/guides/
- Repository: https://github.com/systematic-meerca/neopets-display-scripts
- Script: https://github.com/systematic-meerca/neopets-display-scripts/blob/main/pet-training-timer.user.js

**Pet Sidebar Module** is also on the approved list. Its code passively detects training status pages and stores the displayed remaining time. Its README says all data is stored in the browser and the script contains no automation.

Sources:

- https://github.com/friendly-trenchcoat/Pet-Sidebar-Module
- https://github.com/friendly-trenchcoat/Pet-Sidebar-Module/blob/master/petmodule.user.js

### V1 allowed behavior

- Parse pet name, school, status, and remaining duration from the manually opened status page.
- Store a local deadline.
- Notify when complete.
- Show `Ready now` if already complete.
- Notification click opens that school's status URL.

### Explicitly not allowed

- Completing the course.
- Starting a new course.
- Selecting a stat.
- Buying/searching codestones or dubloons automatically.
- Re-opening the status page in the background to check whether the timer changed.

---

## B. Grave Danger timer — APPROVED FOR V1

### Existing precedent

Pet Sidebar Module is community-listed as a safe userscript and its built-in help/documentation states that its passive data gathering includes **Grave Danger → Grave Danger timer**. Its reminder UI exposes a Grave Danger time remaining and a link back to the activity.

Sources:

- Approved list: https://www.reddit.com/r/neopets/wiki/guides/
- https://github.com/friendly-trenchcoat/Pet-Sidebar-Module
- https://github.com/friendly-trenchcoat/Pet-Sidebar-Module/blob/master/petmodule.user.js

### V1 allowed behavior

- When the human opens Grave Danger and the page contains a visible return/remaining time, capture that rendered value.
- Store the Petpet/pet association only if it is visibly available and useful.
- Notify when the return time is reached.
- Notification click opens Grave Danger.

### Implementation gate

Before coding the production parser, capture representative current HTML fixtures for:

1. active expedition;
2. ready/complete state;
3. no Petpet / unavailable state if applicable.

Do not copy selectors blindly from an old userscript if the live markup has changed.

---

## C. Neolodge timer — APPROVED FOR P1

### Existing precedent

Pet Sidebar Module's passive-data help explicitly lists **Neolodge → Neolodge timer**, and its Quick Ref parser derives a checkout timestamp from the visible Neolodge notice.

Sources:

- https://www.reddit.com/r/neopets/wiki/guides/
- https://github.com/friendly-trenchcoat/Pet-Sidebar-Module/blob/master/petmodule.user.js

### Why P1 rather than P0

The existing PSM parser adds a one-day buffer to the displayed estimate, so the exact intended reminder semantics should be verified against current site behavior rather than copied mechanically.

### Allowed behavior

- Parse the visible checkout estimate from a manually opened page/Quick Ref.
- Locally calculate the deadline.
- Notify when the derived checkout point is reached.

### Required validation

Document whether the UI should mean:

- “checkout estimate reached,”
- “pet definitely checked out,” or
- another conservative threshold.

Do not claim certainty beyond the page's own displayed precision.

---

## D. Kadoatery window timer — APPROVED FOR P1

### Existing precedent

The r/neopets approved list includes **Kadoatery Time Tracker**. Its public description says it adds a countdown to the next window where a refresh could occur, allows the user to input the last known refresh time, and supports desktop notifications before a new potential feeding window.

Sources:

- Approved list: https://www.reddit.com/r/neopets/wiki/guides/
- https://greasyfork.org/en/scripts/526461-kadaotery-time-tracker

### Allowed behavior

Mirror the conservative information model:

- user supplies/updates a known refresh timestamp, or the extension captures an equivalent value that is explicitly rendered to the user;
- extension computes local future windows;
- extension notifies about a potential window.

### Explicitly not allowed

- Automatic Kadoatery refresh.
- Background checks to discover the next refresh.
- Feeding/clicking a Kadoatie automatically.
- A notification-triggered page request.

---

## E. Sidebar Dailies — PRECEDENT ONLY

Sidebar Dailies is on the approved community list and historically tracked daily/cooldown state. However, it spans many activities and is old. Do **not** treat it as blanket permission to add every daily.

Source:

- https://www.reddit.com/r/neopets/wiki/guides/

Admission rule: each activity must receive its own entry in this file with current behavior, current page fixtures, and safety rationale.

---

## F. Generic manual timer — optional, safe utility

A user-created timer with a user-entered name, deadline, and optional Neopets URL performs no site observation and is architecturally low risk. It may be useful as a fallback.

If included, it must not parse or visit URLs in the background. Opening the URL remains a user-click action.

---

## G. PROHIBITED V1 categories

- Restocking/shop refresh alarms coupled to automatic page refresh.
- Autobuyers or price-check loops.
- Quest completion automation.
- Daily reward claiming.
- Wheel spinning.
- Battledome autoplay.
- Automatic game play or score submission.
- Auto-training/auto-complete.
- Any periodic `fetch` to Neopets.
