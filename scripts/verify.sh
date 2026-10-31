#!/usr/bin/env bash
# Canonical verification gate for this repository.
# DSH workflow self-checks first, then the Noveno project gate.
#
# The build runs BEFORE the test suite: structural tests assert production
# output under dist/ (built HTML, compiled theme tokens, JS budget, links,
# source maps, secrets), so the gate is deterministic on a clean checkout
# and never relies on stale local build output. Skipped for projects that
# define no build script.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail=0
note() { printf '%s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }

# Verification lane: declared order in scripts/lib/verify-lane.mjs.
# verify.sh stays a thin caller — the lane module owns the order, so the
# build→test artifact relationship is declared beside the stages, not in
# shell line numbers. Structural stages pin their own ordering via
# tests/verify-lane.test.mjs (imports the lane, not this script).

fail=0
note() { printf '%s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }

bash scripts/verify-template.sh || bad "workflow self-checks failed."
bash scripts/verify-secrets.sh || bad "secret scan failed."

# Build first so structural tests assert a fresh dist/.
if [[ -f package.json ]] && node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" >/dev/null 2>&1; then
  if [[ -f pnpm-lock.yaml ]]; then pnpm run build
  elif [[ -f yarn.lock ]]; then yarn run build
  else npm run build
  fi
fi

# Project doc/branding/env contract (fast, static).
if [[ -x scripts/project-verify.sh ]]; then
  bash scripts/project-verify.sh
fi

# The build above is the gate's explicit artifact relationship and must not be
# removed as "redundant" while structural tests run in the test suite below.
# Only the typecheck remains here — re-running the ci script
# (check + build + test) would triple the gate's work.
# Lane order for the remaining stages (check → test) is declared in
# scripts/lib/verify-lane.mjs; the steps below follow that order.

run_lane_script() {
  local script="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script'] ? 0 : 1)" >/dev/null 2>&1 || return 0
  if [[ -f pnpm-lock.yaml ]]; then pnpm run "$script"
  elif [[ -f yarn.lock ]]; then yarn "$script"
  else npm run "$script"
  fi
}

ran=0

if [[ -f package.json ]]; then
  run_lane_script "check"
  ran=1
fi

# Project test suite (structural tests assert the fresh dist/ built above).
run_lane_script "test"

if [[ "$ran" -eq 0 ]]; then
  if grep -Fxq -- '- Primary users:' docs/PRODUCT.md; then
    printf '\nTemplate-only verification passed. Fill docs/PRODUCT.md on the first /spec.\n'
    exit 0
  fi
  cat >&2 <<'MSG'
No supported project or verification command was found.
Add normal package scripts (format:check/typecheck/lint/test/build or ci),
or create executable scripts/project-verify.sh for this repository.
MSG
  exit 1
fi
