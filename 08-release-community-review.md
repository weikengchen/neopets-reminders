# Release and Community Review Plan

## 1. Before any public release

Publish/source-control the code in an auditable form.

Recommended repository documents:

```text
README.md
SECURITY_AND_FAIR_PLAY.md
PRIVACY.md
SUPPORTED_TIMERS.md
CHANGELOG.md
```

## 2. README fair-play section

Suggested substance:

> This extension is reminder-only. It does not refresh Neopets pages, make background requests to Neopets, click gameplay controls, submit forms, claim rewards, or start/complete activities. Timers are learned from pages the player manually visits (or from explicit manual timer input) and are stored locally. Notifications only tell the player when to return.

Do not say “TNT approved” or “officially safe.”

## 3. Privacy statement

V1 recommended statement:

- reminder data stays in `chrome.storage.local`;
- no analytics by default;
- no account credentials/cookies collected;
- no server/backend;
- uninstalling the extension removes extension-local data according to browser behavior.

## 4. Community review

The r/neopets guide repository explicitly says userscripts can be sent to moderators for checking/approval, and Discord-approved userscripts are recognized there.

For an extension, ask moderators whether they are willing to review the equivalent behavior/code. Even if their formal process is userscript-focused, review feedback is valuable.

Source:  
https://www.reddit.com/r/neopets/wiki/guides/

Suggested review packet:

1. source repository;
2. exact permissions list;
3. supported timer list and precedent links;
4. statement that there is no Neopets network polling;
5. short screencast: manual page → timer captured → tab closed → notification → user click opens page;
6. safety-audit output.

## 5. Chrome Web Store positioning

Category/description should emphasize:

- reminders;
- local storage;
- no automation;
- no credentials.

Avoid keywords that attract the wrong expectation (autobuyer, bot, auto-dailies).

## 6. Adding future timers

Every future PR adding a timer must include:

```text
[ ] precedent URL
[ ] community-review status
[ ] exact visible source information
[ ] manual-navigation explanation
[ ] fixture(s)
[ ] parser tests
[ ] canonical return URL
[ ] safety statement: no background request/action
```

If the feature requires periodically checking Neopets, reject it rather than widening the architecture casually.
