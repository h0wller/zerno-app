# Cashier guest PIN and gift redemption

## User-visible outcomes

1. Cashier-created guest profiles receive a four-digit PIN during creation. The PIN is validated at the API boundary and stored only as a hash. Guests can sign in by phone + PIN without Telegram or OTP.
2. Repeated cashier submissions and attempts to create an account for an existing phone reuse the one canonical customer profile. Existing PINs and loyalty history are never overwritten. If the existing profile has no PIN, the cashier may set one as part of the verified in-person flow.
3. When a cashier redeems a free coffee, the cashier selects the drink first. Exactly one redemption request is sent with the selected item; the reward is not consumed before selection.

## Investigation requirements

- Trace phone normalization, the unique customer phone constraint, staff create/reuse behavior, auth registration and Telegram registration. Confirm duplicate handling is atomic and does not select an arbitrary profile by the last ten digits.
- Trace the cashier redeem button listeners, modal creation/show CSS, overlay lifecycle and the server redeem response.
- Preserve distinct Telegram, SMS and cashier trust boundaries.
- Keep cashier DOM ownership in `public/app/cashier.js`; update `docs/module-map.md` only if ownership changes.

## Verification

- Integration tests: new guest with PIN can log in immediately; invalid PIN is rejected; duplicate create/retry returns the same customer and preserves existing PIN/history; existing guest without PIN can receive one without overwriting an existing PIN.
- Browser test: cashier reward selection modal opens; choosing a drink sends one request with that item; closing/canceling the modal does not redeem.
- Run focused tests, `npm run pretest`, relevant Playwright specs, `npm run audit`/CI as feasible. Record exact tested SHA and distinguish locally run checks from GitHub Actions evidence.
- No merge or deployment.