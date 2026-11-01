# Ponytail repository audit — 2026-11-02

**Repository:** `h0wller/zerno-app`  
**Branch audited:** `pizza`  
**Audited commit:** [`12ec573`](https://github.com/h0wller/zerno-app/commit/12ec573963159fda7c4c2be044581e76d365923c)  
**Method:** whole-repository static/graph review, then direct source inspection of each candidate.  
**Status:** findings recorded; this audit PR does not apply source changes.

## Ranked findings

1. **delete — remove dead helpers from `public/app/core/utils.js`.** The candidates are `hoursNow()`, `hashStr()`, `rng()`, `deliveryHours()`, `getKaliningradTime()` and `isDeliveryServiceOpen()`. The first three have no callers in the indexed graph/source search. Delivery time and availability are already owned by `public/app/delivery.js`; that module defines the active `window.getKaliningradTime` and `window.isDeliveryServiceOpen` contract used by delivery UI/tests. The utility copies are redundant. Before deletion, repeat a repository-wide text search for dynamic/global consumers and keep the existing delivery-clock tests green.

2. **stdlib — remove the hand-written `.env` parser from `scripts/probe-tg-webhook.mjs`.** It currently reads `.env`, parses lines and strips quotes manually. Run the script with Node 22's `--env-file=.env` and read `process.env.PUBLIC_URL`, `process.env.APP_URL` and `process.env.TG_WEBHOOK_SECRET`. Update the usage comment/help to match the new command. Keep the explicit `CHAT_ID` environment override.

3. **stdlib — use `import.meta.dirname` instead of repeating `fileURLToPath(import.meta.url)` plus `path.dirname()`.** Candidate files: `server/config.js`, `server/db/connection.js`, `scripts/brands-check.mjs`, `scripts/fetch-streets.mjs` and `tests/unit/bonus-repair.test.mjs`. The project pins Node 22, which supports `import.meta.dirname`. Preserve each file's existing root/path resolution semantics, especially the database path's independence from `process.cwd()` and Windows-safe dynamic import via `pathToFileURL()` in `brands-check.mjs`.

4. **shrink — inline the one-use `_normalizeUrl()` helper.** In `server/services/telegram.js`, it has one caller. Replace the wrapper with the normalization expression directly in the `PUBLIC_URL` initialization; do not add a shared URL-normalization module for one use.

## Scope and guardrails

- No dependencies need to be added or removed for these findings.
- Do not change delivery time ownership, URL semantics, database location semantics, or Telegram webhook behavior while simplifying.
- Add/retain focused regression checks for the removed helpers' live contracts before deleting them.
- Keep these changes separate from security fixes and UI/accessibility work.

**Estimated simplification:** approximately 60–70 lines removed, no dependency change. This is a planning estimate, not a measured post-change diff.

## Follow-up

Implement the findings in a separate, behavior-preserving refactor PR. This document intentionally records the audit independently so the original findings remain traceable even after fixes are merged.
