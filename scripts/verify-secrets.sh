#!/usr/bin/env bash
# Secret scan: no obvious committed secrets in the worktree (tracked and
# untracked) outside Git metadata, tool output, and installed dependencies.
# Lane stage 2 of scripts/lib/verify-lane.mjs.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p .artifacts
secret_hits="$(mktemp .artifacts/verify-secrets.XXXXXX)"
trap 'rm -f "$secret_hits"' EXIT
if find . -maxdepth 6 -type f \
  ! -path './.git/*' \
  ! -path './.artifacts/*' \
  ! -path './node_modules/*' \
  -print0 |
  xargs -0 grep -En \
    'sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*[^"<${][^[:space:]]+' \
    >"$secret_hits" 2>/dev/null; then
  cat "$secret_hits" >&2
  printf 'FAIL: possible secret found\n' >&2
  exit 1
fi
printf 'Secret scan passed.\n'
