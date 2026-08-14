#!/usr/bin/env bash
# Benchmark sweep: 3 Lighthouse runs per route/profile, median extraction.
# Usage: bash scripts/lab-benchmark.sh [outdir]
set -euo pipefail
OUT="${1:-/tmp/noveno-bench}"
mkdir -p "$OUT"
ROUTES=("/" "/work" "/work/noveno-website" "/audit" "/audit/thank-you")
declare -A PROFILES=( [mobile]="" [desktop]="--preset=desktop" )

for prof in mobile desktop; do
  for route in "${ROUTES[@]}"; do
    name="$(echo "$route" | tr '/' '_')"
    for run in 1 2 3; do
      echo "== $prof $route run $run =="
      npx -y lighthouse "http://127.0.0.1:4173$route" \
        --chrome-path=/usr/bin/chromium \
        --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
        --only-categories=performance ${PROFILES[$prof]} \
        --output=json --output-path="$OUT/${prof}${name}-${run}.json" --quiet \
        >/dev/null 2>&1 || echo "run failed: $prof $route $run"
    done
  done
done
echo "sweep complete in $OUT"
