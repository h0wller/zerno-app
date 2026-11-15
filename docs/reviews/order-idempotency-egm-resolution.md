# Order creation idempotency — review resolution

## Contract

- `POST /api/orders` accepts an optional `client_order_id` for backward compatibility.
- When present, the key must match `[A-Za-z0-9_-]{8,128}`.
- A key is unique within the authenticated customer scope: `(cid, client_order_id)`.
- The request fingerprint is SHA-256 over canonical JSON with object keys sorted recursively and `client_order_id` excluded.
- Same customer + same key + same fingerprint returns the existing order with HTTP 200.
- Same customer + same key + different fingerprint returns HTTP 409 with `IDEMPOTENCY_KEY_REUSED` and the already-created order. The client opens that order, preserves the current cart, and clears the stale attempt key so a deliberate new checkout can use a new key.
- Different keys remain distinct orders. Requests from older clients without a key remain supported.

## Atomicity and persistence

- `orders.client_order_id` and `orders.request_hash` are additive schema migrations; existing orders receive null keys.
- A partial unique index enforces `(cid, client_order_id)` for non-null keys.
- The handler checks for a replay before mutable menu, promo, and slot validation, then repeats the lookup inside a SQLite `BEGIN IMMEDIATE` transaction.
- Promo validation and consumption, promo usage counter updates, order-number allocation, and order insertion commit or roll back together.
- Notifications and the order event log are invoked only after the transaction reports a newly created order. Replays do not invoke them again.

## Client retry lifecycle

- The client stores one pending key in local storage per customer.
- Network errors and reloads retain the key, so an uncertain retry cannot silently become a second order.
- A confirmed success clears the key.
- If the same key is presented with changed checkout data, the server returns the original order as a conflict. The client surfaces that order and leaves the edited cart intact before allowing a new attempt.

## EGM review ledger

- **Completeness:** covers replay, payload mismatch, concurrent submits, promo side effects, order-number allocation, old clients, and client retry persistence.
- **Self-containment:** request-key validation, fingerprint semantics, scope, response behavior, and migration behavior are specified here and tested in the integration suite.
- **Codebase fit:** uses the existing Express route, better-sqlite3 transaction API, existing orders table, and current cart local-storage conventions; no new dependency or endpoint.
- **Structural consistency:** idempotency metadata stays on the order row; the unique index is the durable concurrency guard; no separate cache or TTL can expire a key while its order still exists.
- **Complexity / maintenance:** one additive migration, one partial unique index, one transaction boundary, and one client-side pending-key lifecycle.
- **Compatibility:** missing keys preserve legacy behavior; the client field remains additive.
- **Observability:** changed-payload conflicts have a stable error code; the order is returned to the authenticated owner for recovery.
- **Failure boundary:** notifications are post-commit and invoked only for the first successful create. This prevents duplicate invocation on retries, but is not a transactional outbox: a process crash after commit and before notification can still lose a notification. Exactly-once external delivery is not claimed.

Independent Goldfish review was not available in this execution environment; this is a same-context review ledger, not an independent reviewer verdict.
