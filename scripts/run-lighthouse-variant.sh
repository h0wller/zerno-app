#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$1"; VARIANT="$2"; RUNS="$3"; REPORT_DIR="$4"; PORT="$5"
if [ -z "$PORT" ]; then PORT=3210; fi
DB_PATH="$RUNNER_TEMP/lcp-$VARIANT.sqlite"; SERVER_LOG="$RUNNER_TEMP/lcp-$VARIANT-server.log"
CHROME_PATH="$(find "$HOME/.cache/ms-playwright" -type f -name chrome | head -n 1)"
test -n "$CHROME_PATH" && test -x "$CHROME_PATH"
(cd "$PROJECT_DIR" && NODE_ENV=test DB_PATH="$DB_PATH" PUBLIC_DIR="$PROJECT_DIR/public" PORT="$PORT" ADMIN_CODE='ci-lighthouse-admin-role-code' CASHIER_CODE='ci-lighthouse-cashier-code' DISPATCH_CODE='ci-lighthouse-dispatch-code' TELEGRAM_BOT_TOKEN='' TG_WEBHOOK_SECRET='' SMS_AUTH_ENABLED=false node server.js) >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){ if kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" || true; wait "$SERVER_PID" || true; fi; }
trap cleanup EXIT
ready=0
for attempt in $(seq 1 80); do
 if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then ready=1; break; fi
 if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$SERVER_LOG"; exit 1; fi
 sleep 1
done
if [ "$ready" -ne 1 ]; then cat "$SERVER_LOG"; echo "Server did not become ready for $VARIANT" >&2; exit 1; fi
DB_PATH="$DB_PATH" PUBLIC_DIR="$PROJECT_DIR/public" node "$GITHUB_WORKSPACE/scripts/lighthouse-fixture.mjs"
run_lighthouse(){
 local brand="$1" mode="$2" sample="$3"
 local output="$REPORT_DIR/$VARIANT-$brand-$mode-$sample.json"
 echo "Lighthouse variant=$VARIANT brand=$brand mode=$mode sample=$sample"
 npx --yes lighthouse@13.5.0 "http://127.0.0.1:$PORT/?brand=$brand&lighthouse=1" \
  --chrome-path="$CHROME_PATH" --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --form-factor=mobile --throttling-method="$mode" --throttling.rttMs=150 \
  --throttling.throughputKbps=1638.4 --throttling.cpuSlowdownMultiplier=4 \
  --screenEmulation.mobile=true --screenEmulation.width=360 --screenEmulation.height=800 \
  --screenEmulation.deviceScaleFactor=1.75 --only-categories=performance --max-wait-for-load=45000 \
  --save-assets --output=json --output-path="$output" --quiet
}
for brand in coffee delivery; do
 for sample in $(seq 1 "$RUNS"); do run_lighthouse "$brand" simulate "$sample"; done
 if [[ " ${DEVTOOLS_VARIANTS:-A F} " == *" $VARIANT "* ]]; then for sample in $(seq 1 "${DEVTOOLS_RUNS:-5}"); do run_lighthouse "$brand" devtools "$sample"; done; fi
done
