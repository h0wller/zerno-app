# Strava integration (read-only)

## Current status

Strava is connected as a separate, read-only OAuth provider. This is not a Strava-backed reward provider yet.

- OAuth requests only the `activity:read` scope. No write, private-activity, or full-profile scope is requested.
- The app can show up to 10 recent activities per page, and at most 5 pages, to the same authenticated Zerno profile that connected the Strava account.
- Activity fields are requested from Strava on demand. Activity payloads, GPS, route polylines and derived activity aggregates are not written to SQLite and are not cached by Zerno App. All `/api/fitness/strava/*` responses use `Cache-Control: no-store, private`, and the Service Worker bypasses these routes.
- Only encrypted OAuth credentials, the minimum athlete identifier needed for the connection/webhook, and a short-lived hashed OAuth state are stored. The OAuth state is also bound to the initiating browser by a `Secure; HttpOnly; SameSite=Lax` cookie, so a forwarded authorization URL cannot link another person's Strava account to the attacker's Zerno profile.
- The connection can be revoked from Zerno App; Strava deauthorization events remove the local connection.
- The Strava connection is not passed into `fitness-rewards`. GPX remains the only reward source in the current pilot.

## Strava API policy boundary

The current [Strava API Policy](https://www.strava.com/legal/api_policy), effective June 1, 2026, requires explicit user consent, access limited to the authenticated athlete, deletion on revocation/request, and strict retention controls. Sections 5.4 and 5.10 contain broad restrictions on combining Strava Data with other customer data and on transferring or disclosing Strava Data to third parties. Section 6.2 limits caching to seven days; this implementation avoids caching activity responses entirely.

Because Zerno App's proposed use-case is a coffee reward issued by a business based on a Strava activity, do not derive eligibility, issue a reward, persist a reward decision from Strava activity, or expose a Strava-derived result to cashiers until Strava confirms in writing that this specific model is permitted. Send the described use-case to `developers@strava.com` and retain their written answer with the product/legal decision. The present API does not create Strava-based rewards.

Official references:
- [API Agreement](https://www.strava.com/legal/api)
- [API Policy](https://www.strava.com/legal/api_policy)
- [OAuth authentication](https://developers.strava.com/docs/authentication/)
- [Webhook Events API](https://developers.strava.com/docs/webhooks/)

OAuth code exchange and token refresh use Strava's documented `POST https://www.strava.com/oauth/token` endpoint. Access tokens are proactively refreshed when one hour or less remains; concurrent requests for one profile share a single refresh operation so a rotated refresh token is not raced.

## Required environment

Create a Developer Application in the Strava developer portal and use one API application/token for this registered Zerno App integration. Add these values to the server environment only; never expose them through `GET /api/config`, the client bundle, logs, or Git:

```env
STRAVA_ENABLED=false
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=<secret-from-strava>
STRAVA_REDIRECT_URI=https://friday.andcoffee.online/api/fitness/strava/callback
STRAVA_TOKEN_ENCRYPTION_KEY=<64-hex-characters>
STRAVA_WEBHOOK_VERIFY_TOKEN=<random-token-at-least-16-characters>
STRAVA_WEBHOOK_PATH_SECRET=<random-url-safe-secret-32-to-128-characters>
STRAVA_WEBHOOK_SUBSCRIPTION_ID=<subscription-id-returned-by-strava>
WEBAPP_URL=https://friday.andcoffee.online
```

Generate secrets on the server or in a password manager. Examples:

```sh
openssl rand -hex 32   # STRAVA_TOKEN_ENCRYPTION_KEY
openssl rand -hex 24   # STRAVA_WEBHOOK_VERIFY_TOKEN
openssl rand -hex 32   # STRAVA_WEBHOOK_PATH_SECRET
```

Use the callback domain `friday.andcoffee.online` in the Strava Developer Application settings. The full redirect URI must exactly match `STRAVA_REDIRECT_URI`.

The server refuses to initiate OAuth unless all required values are valid and `STRAVA_ENABLED=true`. The flag remains false until the callback and webhook subscription have been configured and verified.

## Webhook subscription

Strava allows one webhook subscription per application. Check the developer app for an existing subscription before creating another one. The callback URL contains the random path secret:

```sh
curl --request POST 'https://www.strava.com/api/v3/push_subscriptions' \
  --form "client_id=$STRAVA_CLIENT_ID" \
  --form "client_secret=$STRAVA_CLIENT_SECRET" \
  --form "callback_url=https://friday.andcoffee.online/api/fitness/strava/webhook/$STRAVA_WEBHOOK_PATH_SECRET" \
  --form "verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

Copy the returned subscription `id` into `STRAVA_WEBHOOK_SUBSCRIPTION_ID`. Restart the server and only then set `STRAVA_ENABLED=true`. The GET webhook route validates Strava's `hub.verify_token` challenge; the POST route checks both the secret callback path and configured subscription ID. Athlete deauthorization events delete the stored connection. Activity events are acknowledged but not cached because each activity list is fetched live.

## User consent and endpoints

Before redirecting a guest to Strava, the client must:
1. Call `GET /api/fitness/strava/consent` using the guest's Bearer token.
2. Display the returned notice (types of data, collection method, purpose, storage, withdrawal and deletion).
3. Require an affirmative choice, then call `POST /api/fitness/strava/connect` with `{ "consent": true, "consentVersion": "2026-11-14-v1" }`.
4. Open the returned `authorizationUrl` in the system browser, not a constrained embedded webview. The same-origin connect response sets a 10-minute `__Secure-zerno_strava_state` cookie scoped only to the callback path.
5. The callback requires both the one-use OAuth state and the matching browser cookie. It clears the cookie on return; missing/mismatched cookies are rejected, preventing an authorization URL from being forwarded to another browser.
6. After callback, refresh `GET /api/fitness/strava/status` and fetch `GET /api/fitness/strava/activities` only when the user asks to view them.

Relevant endpoints:
- `GET /api/fitness/strava/consent` — user-facing notice.
- `GET /api/fitness/strava/status` — current profile's connection status.
- `POST /api/fitness/strava/connect` — starts OAuth after versioned consent.
- `GET /api/fitness/strava/callback` — exchanges one-use authorization code and state.
- `GET /api/fitness/strava/activities?page=1&per_page=10` — latest personal activities; no database/cache write.
- `POST /api/fitness/strava/disconnect` — deletes local tokens and calls `POST https://www.strava.com/oauth/revoke`.
- Webhook: `/api/fitness/strava/webhook/{secret}` — provider verification and athlete deauthorization callback.

## Storage and deletion

- Access and refresh tokens are encrypted using AES-256-GCM. The key is exactly 32 bytes, provided as 64 hex characters.
- OAuth state is random, single-use, stored as SHA-256 only, and expires after 10 minutes. Its raw value is also placed in a host-only `Secure; HttpOnly; SameSite=Lax` cookie, limited to `/api/fitness/strava/callback`; the callback compares it in constant time and clears it.
- Activity responses are returned only to the authenticated profile that owns the connection and are not persisted.
- Disconnect deletes the connection and outstanding OAuth states before attempting remote token revocation. The API response indicates whether Strava confirmed remote revocation.
- Deleting a Zerno profile removes the Strava connection through the same disconnect service; foreign keys also cascade connection/state rows.
- A provider 401 or explicit deauthorization removes the local connection. The user must consent again to reconnect.

If remote revocation cannot be confirmed, local credentials are still deleted and the user should also remove Zerno App from the connected apps page in Strava. No raw tokens or full activity responses should be written to server logs.

## Access tier and operations

Strava's current policy describes Standard Tier levels with registered-athlete capacity limits and additional subscription requirements. Confirm the actual capacity and eligibility shown for this Developer Application in the Strava portal; do not assume a production-scale limit from a development app. Strava may change access tiers and approval at its discretion.

The live provider flow cannot be tested until the real Client ID, Client Secret, callback domain and webhook subscription are configured in the deployment environment. Automated tests use fake Strava HTTP responses and never require real credentials.
