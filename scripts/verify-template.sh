#!/usr/bin/env bash
# Workflow self-checks: whitespace, DSH skill discovery frontmatter, delivery
# helper parse, and legacy workflow pins. Lane stage 1 of scripts/lib/verify-lane.mjs.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail=0
bad() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git --no-pager diff --check || bad "git diff --check reported whitespace errors."
fi

[[ -f docs/WORKFLOW.md ]] || bad "docs/WORKFLOW.md is missing."
[[ -d .dsh/skills ]] || bad ".dsh/skills is missing."

for skill in .dsh/skills/*/SKILL.md; do
  [[ -f "$skill" ]] || continue
  dir="$(basename "$(dirname "$skill")")"
  front="$(sed -n '1,/^---$/p' "$skill" | sed '1d;$d')"
  name="$(printf '%s\n' "$front" | sed -n 's/^name:[[:space:]]*//p' | head -n 1)"
  grep -Eq '^name: .+' <<<"$front" || bad "$skill is missing frontmatter name."
  grep -Eq '^description: .+' <<<"$front" || bad "$skill is missing frontmatter description."
  [[ "$name" == "$dir" ]] || bad "$skill frontmatter name does not match its directory."
done

for required in quick-fix spec build verify review test-design ship; do
  [[ -f ".dsh/skills/$required/SKILL.md" ]] || bad ".dsh/skills/$required/SKILL.md is missing."
done

if command -v node >/dev/null 2>&1; then
  node --check scripts/deliver-pr.mjs || bad "scripts/deliver-pr.mjs does not parse."
fi

for legacy in .omp .pi scripts/omp-pr.mjs scripts/ai-pr.mjs Dockerfile.pi p; do
  if [[ -e "$legacy" ]]; then
    bad "legacy workflow path remains: $legacy"
  fi
done

[[ "$fail" -eq 0 ]] || exit 1
printf 'Workflow self-checks passed.\n'
