#!/usr/bin/env bash
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
  curl -L --fail --max-time 180 -sS \
    -o "$tmp_dir/$slug.png" \
    "https://image.thum.io/get/width/1440/crop/900/wait/5/noanimate/$url"
  convert "$tmp_dir/$slug.png" -crop 1440x900+0+0 +repage -strip -quality 86 \
    "$out_dir/$slug-hero.webp"
  convert "$tmp_dir/$slug.png" -crop 1440x900+0+0 +repage -resize 720x450 -strip -quality 84 \
    "$out_dir/$slug-hero-800.webp"
done
