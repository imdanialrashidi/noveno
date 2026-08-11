#!/usr/bin/env bash
# Project-specific verification gate for the Noveno production website.
# Hooked into the canonical full gate by scripts/verify.sh. Kept fast and
# static: it proves the durable project contract (Noveno identity, theme
# anchors, brand assets, env hygiene, verification routes) without running
# an application that does not exist yet.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node scripts/check-project-contract.mjs
