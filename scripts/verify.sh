#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The canonical gate verifies the built project: structural tests assert
# production output under dist/ (built HTML, compiled theme tokens, JS
# budget, links, source maps, secrets). Produce a fresh build before the
# workflow test suite runs so the gate is deterministic on a clean checkout
# and never relies on stale local build output. Skipped for projects that
# define no build script.
if [[ -f package.json ]] && node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" >/dev/null 2>&1; then
  if [[ -f pnpm-lock.yaml ]]; then pnpm run build
  elif [[ -f yarn.lock ]]; then yarn build
  else npm run build
  fi
fi

# The build above is the gate's explicit artifact relationship and must not be
# removed as "redundant" while structural tests run inside pi-doctor's test
# suite.

bash scripts/pi-doctor.sh --ci

if [[ -x scripts/project-verify.sh ]]; then
  exec scripts/project-verify.sh
fi

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
  # The workflow suite already ran inside pi-doctor --ci; the build already
  # happened above. Only the typecheck remains — re-running the ci script
  # (check + build + test) here would triple the gate's work.
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.check ? 0 : 1)" >/dev/null 2>&1; then
    run_node_script "check"
  else
    run_node_script "format:check"
    run_node_script "typecheck"
    run_node_script "lint"
    run_node_script "test"
    run_node_script "build"
  fi
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

if [[ "$ran" -eq 0 ]]; then
  if grep -Fxq -- '- Primary users:' docs/PRODUCT.md; then
    printf '\nTemplate-only verification passed. Run /bootstrap after adding product source.\n'
    exit 0
  fi
  cat >&2 <<'MSG'
No supported project or verification command was found.
Add normal package scripts (format:check/typecheck/lint/test/build or ci),
or create executable scripts/project-verify.sh for this repository.
MSG
  exit 1
fi
