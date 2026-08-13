# Chrome Web Store listing draft

**Not affiliated with Neopets, Inc. or TNT.** Do not use official logos, characters, or claim approval.

## Name (45 characters max)

**Visit Reminders**

Alternates if the name is taken:

- Visit Timer Reminders
- Local Page Timers

Avoid: auto, bot, cheat, hack, “official”.

Using “Neopets” in the **title** is better avoided (trademark). Nominative use in the description is usually OK if you state unofficial status.

## Short description (132 characters max)

```
Local countdown reminders for timers on pages you already open. It does not play or automate the game.
```

(110 characters)

## Detailed description

```
Visit Reminders is a local companion for countdown information that is already on pages you open yourself.

How it works
• You visit a supported page in Chrome.
• The extension reads the timer or status already shown on that page.
• It keeps a local deadline and can notify you when it is time to return.
• Open buttons and notifications only open a page after you click.

It does not
• Play the game or click Join, Collect, Heal, Send, or Approach for you
• Refresh pages or request game data in the background
• Read passwords, cookies, or account balances
• Send your data to a server

Supported (best-effort)
• Training status (Mystery Island and Pirate Academy)
• Hospital Volunteer
• Grave Danger
• Healing Springs
• Coltzan’s Shrine
• Qasalan Expellibox

Some timers are a snapshot of the page at the moment you viewed it. Others are a local estimate (for example a fixed cooldown). They are not a live server clock.

This extension is unofficial and is not endorsed by Neopets or TNT.
```

## Category

Productivity

## Language

English (primary). Optional Chinese listing later.

## Single purpose (reviewer form)

```
Show local countdown reminders for timer information the user has already viewed on specific pages.
```

## Permission justifications

| Permission | Why |
| --- | --- |
| `storage` | Save reminder deadlines and settings on this device only |
| `alarms` | Wake the extension when a saved deadline is due |
| `notifications` | Show a local completion reminder |

No `tabs`, `scripting`, cookies, or `<all_urls>`.

Content scripts match only the listed game pages the user opens.

## Privacy policy URL

Host `PRIVACY.md` (or a rendered page) and paste that HTTPS URL in the dashboard.

## Screenshots (need 1–5, 1280×800 or 640×400)

Capture from the real popup after Reload:

1. Upcoming timers with second countdown  
2. Ready list  
3. Open buttons (two-column)  
4. Settings at the bottom  

Do not include account names, NP, or real pet names.

## Store icon

Use `src/assets/icon-128.png` (also `icon-512.png` as a master).  
Original clock-on-slate mark — not a Neopets asset.

## Version

Ship as `1.0.0` when you submit.

## Pre-submit checklist

- [ ] `npm run check`  
- [ ] Zip **contents of `dist/`** so `manifest.json` is at the zip root  
- [ ] Developer account + one-time fee  
- [ ] Privacy policy URL live  
- [ ] Screenshots + 128 icon  
- [ ] “Not affiliated” in description  
- [ ] Trusted testers first (optional)
