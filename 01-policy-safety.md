# Policy and Safety Boundary

## 1. The design rule

**Observe, never act.**

Permitted by this project's internal policy:

- Read DOM that is already rendered because the human navigated to the page.
- Parse an explicitly displayed countdown/status.
- Convert a displayed remaining duration into a local absolute timestamp.
- Store the timestamp locally.
- Show countdown/status inside extension UI.
- Schedule a local Chrome notification.
- Open the relevant Neopets page after an explicit user click.

Prohibited by this project's internal policy:

- Programmatically visit Neopets to obtain fresh state.
- `fetch`/XHR/poll a Neopets page in the background.
- Auto-refresh any Neopets page.
- Auto-submit forms.
- Programmatically click gameplay controls on Neopets pages.
- Claim/collect/start/complete/buy/feed/train/play automatically.
- Use a timer to trigger a Neopets request.
- Scrape hidden or non-rendered state to gain a timing advantage.
- Keep a background page alive to repeatedly inspect the site.

## 2. Official Neopets evidence

### Current Play Fair statement

The 2025 Neopian Task Force “Play Fair” announcement says Neopets is improving detection/prevention to crack down on bot usage and automated gameplay.

Source:  
https://portal.neopets.com/news/may7-neopian-task-force-play-fair

### Historical Editorial — macro for dailies

Neopian Times Editorial, issue/week 383: TNT answered that players may not use automated programs to play Neopets for them. The question specifically concerned a macro replaying actions for simple dailies. The same answer distinguishes ordinary bookmarks/links from automation.

Source:  
https://www.neopets.com/ntimes/index.phtml?section=editorial&week=383

### Historical Editorial — automatic refresh

Neopian Times Editorial, issue/week 277: TNT treated automatic refreshing as gameplay assistance even when the program did not perform the final purchase. Their reasoning is that automated page visits create an advantage and amount to someone/program playing part of the game for the user.

Source:  
https://www.neopets.com/ntimes/index.phtml?section=editorial&week=277

## 3. Community-reviewed userscript precedent

The r/neopets Guide Repository says, under its Userscripts section, that only “safe” scripts are allowed there, describing that as nothing automated that would be against Neopets rules; scripts can be checked/approved by moderators, and Discord-approved scripts are accepted there.

As of the review date, the list includes:

- friendly-trenchcoat's Pet Sidebar Module
- systematic-meerca's Training Timer
- darknstormy's Kadoatery Time Tracker
- Sidebar Dailies and other utility scripts

Source:  
https://www.reddit.com/r/neopets/wiki/guides/

**Important:** r/neopets/Discord approval is not TNT approval. Never market the extension as “approved by Neopets” unless TNT explicitly approves it.

## 4. Why passive timer capture is materially different from automation

The extension's event chain must remain:

```text
human request → page renders → local observation → local timer → local notification → human request
```

Never:

```text
timer/background worker → Neopets request → gameplay state change/reward opportunity
```

This distinction should be visible in the architecture itself, not merely promised in documentation.

## 5. Architectural enforcement

### Content scripts

Content scripts may:

- inspect text/DOM;
- call pure parser functions;
- send parsed observations to the extension service worker;
- optionally add a passive visual marker.

Content scripts may not:

- call `fetch` against Neopets;
- create XHR/WebSocket/EventSource connections;
- call `location.reload()`;
- submit forms;
- click Neopets controls;
- change navigation automatically.

### Service worker

Service worker may:

- read/write extension storage;
- create/clear Chrome alarms;
- create notifications;
- open a saved URL only after explicit extension/notification user interaction.

Service worker may not:

- request Neopets pages;
- keep account cookies/tokens;
- emulate a logged-in browser request;
- poll site state.

## 6. Feature admission test

A new timer may ship only if every item below is true:

1. **Observable:** timing/status is already visible to the player or manually supplied by the player.
2. **Manual navigation:** the extension learns it only after a human opens the relevant page, unless the timer is a fixed public schedule/manual timer.
3. **Local-only:** no Neopets request is necessary to keep the timer current.
4. **Reminder-only:** the timer's completion produces a notification/status, not a gameplay action.
5. **Precedent:** equivalent countdown/reminder behavior exists in a community-reviewed safe userscript, or has separately received community safety review.
6. **Documented:** the evidence URL and exact behavior are added to `02-feature-whitelist.md` before implementation.

If any answer is “no” or uncertain, do not ship the feature until reviewed.

## 7. Marketing language

Recommended:

> A local reminder companion for Neopets. It reads timer information from pages you manually visit and notifies you when it is time to return. It does not automate gameplay.

Avoid:

- “auto dailies”
- “automation assistant”
- “bot helper”
- “never miss rewards automatically”
- “approved by Neopets”

## 8. Privacy boundary

Default to local-only storage. Do not collect:

- passwords;
- cookies/session tokens;
- Neopass credentials;
- browser history outside supported pages;
- item inventories or account economics unless later explicitly needed and reviewed.

Pet names and reminder metadata can remain in `chrome.storage.local` and should never leave the device in V1.
