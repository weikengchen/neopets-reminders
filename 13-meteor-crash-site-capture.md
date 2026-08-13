# Meteor Crash Site 725-XZ — design notes + fixture capture

**Status:** research / capture only. Not on the feature whitelist yet. Do not implement parser until fixtures exist and owner admits the activity.

**Safety:** observe, never act. No poke, no form submit, no refresh farming.

## Page

- URL: `https://www.neopets.com/moon/meteor.phtml`
- Time zone for game day: **NST = America/Los_Angeles** (already used for Coltzan).
- Owner local display (later UI): also show **Asia/Singapore (UTC+8)**.

## Product rules (owner)

Two independent layers:

1. **Visit cooldown (~60 minutes)**  
   Any completed visit/submit counts: poke with a stick, run away, or empty submit.  
   Cooldown is **about 60 minutes after last visit**, not “must align to NST clock hours.”  
   Do not nag while this cooldown is active.

2. **Daily prize cap (1 prize per Neopian day)**  
   After a win, do not remind the user to poke again that NST day.  
   Same-hour re-visit after a win may show “meteor too hot.”  
   Later the same day a Grundo scientist may send the user away until the next NST day (typically **midnight NST**, not Coltzan’s 12:26).

State machine for a future local record (`kind: 'meteor'`, single `idKey: 'self'`):

| Last observed outcome | `prizeWonToday` | `nextEligibleAt` |
| --- | --- | --- |
| Miss / no prize (including run away / empty submit if that still counts as a visit) | `false` | `lastVisitAt + 60 minutes` |
| Prize won | `true` | next **00:00 NST** after `lastVisitAt` |
| Cooldown / too-hot / scientist-away copy, and we already have a future `nextEligibleAt` | keep existing | keep existing (do not reset to a full extra 60m unless evidence says the visit counted again) |
| Available (can poke) and no blocking copy | no new timer | none / ready |

Popup/notification: when due, only tell the user and open the canonical URL **after a click**. Never auto-submit.

Jellyneo hit rate (~20–25%) is flavor only — do not encode into logic.

## How this maps to current architecture

Same family as Healing Springs / Coltzan:

- No reliable remaining countdown expected on the page.
- Success / miss / cooldown are **copy + controls** on a page the user opened.
- Local `dueAt` / `nextEligibleAt` is an **estimate**.
- `replaceScope` for a single-slot activity.

Unlike Training/Hospital: do not treat this as a live process timer.

**Cannot** start the 60-minute clock from a visit that happened only in the owner’s memory. The extension starts tracking only after it **observes** this page (result or cooldown copy). Owner’s “already visited this hour, no prize” will apply on the next manual open if the DOM still shows a post-visit / cooldown state, or after the next observed submit result.

## Desired fixtures (human opens; Luna/agent only reads)

Directory: `tests/fixtures/meteor/`

| File | State to capture |
| --- | --- |
| `available.html` | Can poke / form visible, not blocked |
| `result-miss.html` | After a manual visit with **no prize** |
| `result-prize.html` | After a manual **prize** (redact item name if identifying; keep structure) |
| `cooldown.html` | Too soon / wait ~hour copy (if distinct from miss) |
| `too-hot.html` | Same-hour after prize, if observed |
| `scientist-away.html` | Grundo sends you away until next day, if observed |
| `malformed.html` | Optional handwritten negative |
| `README.md` | Provenance |

If a state is not available, **do not invent HTML**.

### Capture rules

- User may click poke / submit; the agent must not.
- Small sanitized fragments only.
- Strip account chrome, NP/NC, real pet names, cookies, hidden ids, image dumps.
- Keep: heading, button labels, blocking copy, result lead-in sentences.
- README must answer: is there a **numeric remaining** minutes field? (expected: no)
- Record exact cooldown / prize / miss / scientist sentences.

## Admission

Not implemented until:

1. Fixtures exist and are owner-reviewed.
2. Explicit admit into whitelist / popup Open row.
3. Parser uses only evidenced copy; unknown pages must not start a fake 60m timer.

## Prompt for Luna (copy-paste)

```text
你在仓库 `/Users/cusgadmin/neopets-extension` 做 Meteor Crash Site fixture 采集，不要实现 parser。

必读：`13-meteor-crash-site-capture.md`、`01-policy-safety.md`、`tests/fixtures/healing-springs/`（固定冷却片段风格）。

页面：https://www.neopets.com/moon/meteor.phtml
只读用户已打开/已提交后的 DOM。禁止代点 poke、禁止自动提交、禁止刷新刷奖、禁止 fetch。

采集到 tests/fixtures/meteor/：
- available.html
- result-miss.html（用户手动去过且没中奖）
- result-prize.html（若这次中了；奖品名可脱敏）
- cooldown.html / too-hot.html / scientist-away.html（仅当真实出现）
- README.md（日期、最终 URL、有无 numeric remaining、逐句冷却/中奖/未中/赶走文案、脱敏说明）

不可得的状态不要伪造。中文短报告列出已有/缺失文件。不要改 src/、不要 push。
```
