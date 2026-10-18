#!/usr/bin/env bash
# Template self-checks: whitespace, omp discovery frontmatter, PR helper
# parse, legacy workflow pins. Lane stage 1 of scripts/lib/verify-lane.mjs.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail=0
bad() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git --no-pager diff --check || bad "git diff --check reported whitespace errors."
fi

for skill in .omp/skills/*/SKILL.md; do
  [[ -f "$skill" ]] || continue
  front="$(sed -n '1,/^---$/p' "$skill" | sed '1d;$d')"
  grep -Eq '^name: .+' <<<"$front" || bad "$skill is missing frontmatter name."
  grep -Eq '^description: .+' <<<"$front" || bad "$skill is missing frontmatter description."
done

for cmd in .omp/commands/*.md; do
  [[ -f "$cmd" ]] || continue
  head -n 5 "$cmd" | grep -Eq '^description: .+' || bad "$cmd is missing frontmatter description."
done

if command -v node >/dev/null 2>&1; then
  node --check scripts/omp-pr.mjs || bad "scripts/omp-pr.mjs does not parse."
fi

for legacy in .pi scripts/ai-pr.mjs Dockerfile.pi p; do
  if [[ -e "$legacy" ]]; then
    bad "legacy Pi workflow file remains: $legacy"
  fi
done

[[ "$fail" -eq 0 ]] || exit 1
printf 'Template self-checks passed.\n'
