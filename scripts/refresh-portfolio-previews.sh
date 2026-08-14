#!/usr/bin/env bash
# Refresh portfolio previews from the public live sites (thum.io capture).
# Downloads each site's homepage at 1440×900, then runs the shared Pillow
# optimizer (scripts/optimize-work-previews.py) which emits WebP q80 +
# AVIF q62 at 1440×900 and 720×450 — the exact variants the site ships.
#
# Usage: bash scripts/refresh-portfolio-previews.sh
# After refresh: npm run build (image manifest re-hashes), then review the
# new previews in the browser (docs/IMAGERY.md §work).
set -euo pipefail

out_dir="public/images/work"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$out_dir"

items=(
  "mobile-khorsandi|https://mobilekhorsandi.ir/"
  "elsa-hamrah|https://elsahamrah.com/"
  "php-ielts-house|https://phpieltshouse.ir/"
  "isbatab|https://isbatab.ir/"
  "danial-rashidi-portfolio|https://imdanialrashidi.github.io/"
)

for item in "${items[@]}"; do
  slug="${item%%|*}"
  url="${item#*|}"
  echo "== $slug =="
  curl -L --fail --max-time 180 -sS \
    -o "$tmp_dir/$slug.png" \
    "https://image.thum.io/get/width/1440/crop/900/wait/5/noanimate/$url"
  python3 scripts/optimize-work-previews.py "$tmp_dir/$slug.png" "$slug-hero"
done

echo "Done. Run: npm run build   (re-hashes the manifest)"
