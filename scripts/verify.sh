#!/usr/bin/env bash
# Canonical verification gate for this repository.
# omp template self-checks first, then the Noveno project gate.
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

# 1. Whitespace errors in tracked changes.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git --no-pager diff --check || bad "git diff --check reported whitespace errors."
fi

# 2. Every skill needs name + description frontmatter (omp discovery requires description).
for skill in .omp/skills/*/SKILL.md; do
  [[ -f "$skill" ]] || continue
  front="$(sed -n '1,/^---$/p' "$skill" | sed '1d;$d')"
  grep -Eq '^name: .+' <<<"$front" || bad "$skill is missing frontmatter name."
  grep -Eq '^description: .+' <<<"$front" || bad "$skill is missing frontmatter description."
done

# 3. Every file command needs a description frontmatter.
for cmd in .omp/commands/*.md; do
  [[ -f "$cmd" ]] || continue
  head -n 5 "$cmd" | grep -Eq '^description: .+' || bad "$cmd is missing frontmatter description."
done

# 4. PR helper must parse.
if command -v node >/dev/null 2>&1; then
  node --check scripts/omp-pr.mjs || bad "scripts/omp-pr.mjs does not parse."
else
  note "SKIP: node not installed; cannot syntax-check scripts/omp-pr.mjs."
fi

# 5. Legacy Pi workflow must be gone (migration pin).
for legacy in .pi scripts/ai-pr.mjs Dockerfile.pi p; do
  if [[ -e "$legacy" ]]; then
    bad "legacy Pi workflow file remains: $legacy"
  fi
done

[[ "$fail" -eq 0 ]] || exit 1
note "Template self-checks passed."

# 6. No obvious committed secrets. Scans worktree files (tracked and
# untracked) outside Git metadata, tool output, and installed dependencies.
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
  bad "possible secret found"
else
  note "Secret scan passed."
fi
[[ "$fail" -eq 0 ]] || exit 1

# 7. Build first so structural tests assert a fresh dist/.
if [[ -f package.json ]] && node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" >/dev/null 2>&1; then
  if [[ -f pnpm-lock.yaml ]]; then pnpm run build
  elif [[ -f yarn.lock ]]; then yarn run build
  else npm run build
  fi
fi

# 8. Project doc/branding/env contract (fast, static).
if [[ -x scripts/project-verify.sh ]]; then
  bash scripts/project-verify.sh
fi

# The build above is the gate's explicit artifact relationship and must not be
# removed as "redundant" while structural tests run in the test suite below.
# Only the typecheck remains here — re-running the ci script
# (check + build + test) would triple the gate's work.

ran=0

run_node_script() {
  local script="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script'] ? 0 : 1)" >/dev/null 2>&1 || return 0
  ran=1
  if [[ -f pnpm-lock.yaml ]]; then pnpm run "$script"
  elif [[ -f yarn.lock ]]; then yarn "$script"
  else npm run "$script"
  fi
}

if [[ -f package.json ]]; then
  run_node_script "check"
fi

if [[ -f pyproject.toml || -f requirements.txt ]]; then
  ran=1
  python -m compileall -q -x '(^|/)(\.venv|venv|build|dist|node_modules)/' .
  command -v ruff >/dev/null 2>&1 && ruff check .
  command -v mypy >/dev/null 2>&1 && mypy .
  command -v pytest >/dev/null 2>&1 && pytest
fi

if [[ -f go.mod ]]; then
  ran=1
  unformatted="$(gofmt -l .)"
  [[ -z "$unformatted" ]] || { printf 'Unformatted Go files:\n%s\n' "$unformatted" >&2; exit 1; }
  go vet ./...
  go test ./...
fi

if [[ -f Cargo.toml ]]; then
  ran=1
  cargo fmt --all -- --check
  cargo clippy --all-targets --all-features -- -D warnings
  cargo test --all-features
fi

# 9. Project test suite (structural tests assert the fresh dist/ built above).
run_node_script "test"

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
