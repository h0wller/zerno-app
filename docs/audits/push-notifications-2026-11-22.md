# Audit: push notifications and related delivery paths

**Date:** 2026-11-22  
**Implementation PR:** [#305](https://github.com/h0wller/zerno-app/pull/305)  
**Base:** `pizza`  
**Status:** implemented in the PR branch; CI is the acceptance gate. No production deployment is implied.

## Root causes confirmed in source

1. The Service Worker had no `push` event handler and never called `showNotification()`. It also did not send the `zpush` message that the live UI listens for.
2. The push settings UI treated subscription registration as delivery success and showed a success toast before sending a test notification.
3. Telegram HTML was reused as the FCM/Web Push body. This leaks markup to device notifications and couples Telegram parse errors to unrelated channels.
4. Device cleanup removed Web Push subscriptions but not FCM tokens. FCM registration used `INSERT OR IGNORE`, so an existing token could remain associated with the previous customer after sign-in on another account.
5. Some staff/admin broadcasts bypassed the common sender and excluded people without Telegram, including FCM-only recipients.
6. A transient error during session verification cleared the saved bearer token; successful session restoration also needed to clear the dead-auth flag.
7. The order tracking UI did not accurately distinguish cancellation and pickup, did not include all price components, and replaced modal markup during polling.
8. The scan flow could receive a camera stream after the user had already closed the scanner.
9. The delay-all endpoint could affect future preorders and accepted invalid delay values.
10. The request helper had no timeout; global GET deduplication could share a request even when a caller supplied its own abort signal.

## Changes in this PR

- Service Worker now parses JSON/text push payloads, displays system notifications, sends `zpush` to open windows, and focuses/navigates the app when a notification is clicked. Notification URLs are restricted to the app origin.
- `/api/push/test` reports success only when Web Push or FCM accepts a delivery attempt. The UI sends this test after saving the subscription and does not announce success before that result.
- Push payload contract: `{ title, text, html }`. Plain text is used for Web Push/FCM; Telegram HTML is kept separate. Telegram parse-entity failures retry as plain text; long messages are converted before truncation.
- FCM token registration is an upsert that reassigns ownership. Explicit unsubscribe and logout remove only the endpoint/token for the current device; other devices signed into the same account remain registered. Empty unregister requests are rejected.
- Admin broadcasts and staff-order notifications use the shared fan-out across enabled Telegram, Web Push and FCM channels.
- Auth verification preserves the token after transient network/server errors and retries on the online event; successful `setUser` resets the dead-auth flag.
- Order polling is reduced to 15 seconds for orders and 45 seconds for profile state; `zpush` still triggers immediate refresh.
- Order tracking displays distinct cancel, pickup and delivery states and all stored price components. It only replaces modal contents when tracked order fields change.
- Scan camera startup checks a generation token after permission resolves; a late stream is stopped if the scanner has already closed.
- API requests have a 20-second timeout; deduplication excludes requests with caller-owned abort signals.
- Delay-all accepts integer values from 1 to 180 and applies only to active regular orders and preorders scheduled for the current local business date; future preorders are excluded.
- Added API boundary validation for customer names (2–24 chars), floor/clamp of order quantities, live toast accessibility/duration, and auth-token removal from the browser URL after capture.

## Regression coverage

- `tests/unit/service-worker-push.test.mjs`: push display, raw-text fallback, `zpush`, notification-click focus/navigation and external-origin rejection.
- `tests/bot-copy.spec.mjs`: Telegram malformed-HTML fallback and long-message plain-text truncation.
- `tests/integration/auth-otp-routes.test.mjs`: profile name limits, precise device unsubscribe, logout cleanup, batch stamp promo and replay prevention.
- `tests/order-tracking-contact.spec.js`: canceled order, pickup and delivery states, modifiers, gifts, discount, ETA and delivery fee.
- `tests/staff-stops.spec.js`: shared gift picker for search/QR paths and cancel-without-redemption.
- CI runs the relevant Playwright Staff API group after rebuilding the client bundle.

## Delivery and acceptance boundary

A successful Web Push HTTP response means the push service accepted the send attempt; it does not prove that the operating system displayed the notification to a person. The browser test endpoint therefore reports handoff to Web Push/FCM, while visible receipt still depends on browser/OS permission, platform support and the active push subscription.

Production deployment is manual in this repository. This PR does not merge or deploy itself; after CI and visual/operational review, the deployment workflow must be run explicitly.
