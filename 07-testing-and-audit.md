# Testing and Safety Audit

## 1. Parser unit tests

For every supported activity:

- [ ] normal active timer
- [ ] ready/complete state
- [ ] singular/plural time units
- [ ] multiple pets/rows if applicable
- [ ] missing timer text
- [ ] malformed/unexpected markup
- [ ] whitespace variation
- [ ] page redesign causes safe failure, not fabricated deadline

## 2. Reminder-store tests

- [ ] stable ID upserts rather than duplicates
- [ ] new observation updates deadline
- [ ] expired reminder becomes ready
- [ ] remove clears alarm
- [ ] disabled reminder type does not notify
- [ ] stale old parser-version state is handled deliberately

## 3. Alarm tests

- [ ] alarm created for future deadline
- [ ] alarm removed when reminder removed
- [ ] reconciliation recreates missing alarm
- [ ] reconciliation removes orphan alarm
- [ ] service-worker restart does not lose state
- [ ] browser restart test
- [ ] simulated sleep/past-due test

## 4. Notification tests

- [ ] one notification on due
- [ ] no repeated notification after worker restart
- [ ] click opens canonical supported URL
- [ ] notification does not cause an HTTP request until the user clicks
- [ ] no gameplay action occurs after tab opens
- [ ] Test Notification works with no Neopets page open

## 5. Safety static audit

Fail CI/release if production source contains unreviewed use of:

```text
fetch(
XMLHttpRequest
WebSocket
EventSource
chrome.webRequest
chrome.declarativeNetRequest
chrome.cookies
location.reload
window.location.reload
form.submit
requestSubmit
```

Caveat: some strings may appear in tests/docs. Audit production bundles/source paths, not prose.

### DOM click audit

Programmatic `.click()` may be legitimate inside the extension's own popup, so do not blanket-ban it. Instead enforce:

- content-script code may not call `.click()` on Neopets DOM;
- no content-script helper exposes a generic action/click API;
- extension UI buttons communicate to background logic only for local operations or explicit navigation.

## 6. Network audit

V1 should require no outbound network communication other than the browser's **ordinary user-initiated navigation** to Neopets.

Test with DevTools/network logging:

1. open a supported Neopets page manually;
2. let extension capture reminder;
3. close Neopets tab;
4. leave Chrome running through alarm;
5. verify no request to `neopets.com` occurs at alarm time;
6. click notification;
7. only now should normal navigation request occur.

## 7. Permissions audit

Release manifest should contain only permissions justified by the architecture.

Expected V1:

```text
storage
alarms
notifications
```

Plus narrowly scoped host access/content-script matches for supported Neopets pages.

Reject accidental addition of:

```text
cookies
webRequest
declarativeNetRequest
history
<all_urls>
```

unless a future written review explicitly changes the policy.

## 8. Human gameplay audit

For every feature, demonstrate:

```text
Can the extension obtain the reminder without the player opening the relevant page?
```

Expected answer: **No**, except manually-entered/fixed public schedule timers.

```text
Can the extension cause a gameplay state change after the timer expires?
```

Expected answer: **No**.

```text
Can the extension create extra refresh/page-view opportunities while the player is elsewhere?
```

Expected answer: **No**.

## 9. Regression requirement

Every Neopets markup fix must add/update a local fixture and parser test. Avoid “quick selector fixes” without tests because silent wrong deadlines are worse than a visible parser failure.
