---
name: verify
description: Select and run the cheapest verification lane that proves an accepted change, from affected checks to the full gate. Use after implementing a slice, before /ship, or when asked what to run.
---

# Verification lanes

Pick the cheapest lane that matches the change; never jump to the full gate by default.

- **Affected:** the exact new test first, then the nearest existing tests covering the changed symbols (resolve dependents through `lsp` references, not guesses). For content-only edits, an exact content assertion or parser may suffice.
- **Feature:** the affected lane plus every check that exercises the accepted slice end to end (API/CLI exercise, `eval`/`bash` run of the journey, browser-tool pass for browser-visible behavior).
- **Full:** the repository's canonical gate (`scripts/verify.sh`, or the documented suite when the repo defines one). Required before `/ship` of Standard-or-larger work, after harness/workflow changes, and when affected selection cannot bound the risk.

## Risk tiers (set by scope and impact, not by author)

- **Low:** docs/copy-only, internal comment, flag-gated additive change with no behavior change to existing paths. Lane: affected only; keep lightweight, no reviewer pass or full gate required.
- **Medium:** ordinary behavioral, cross-module, or architectural change. Lane: affected + feature; `/review` when non-trivial user-facing, cross-module, production-bug, or material-regression work.
- **High:** security-sensitive, auth/access, money, secrets/privacy, upload/callback, schema/migration/deletion, public API, concurrency, infra/CI/CD, or release-workflow change. Lane: affected + feature + full gate (`scripts/verify.sh` and existing CI — never a duplicate verification system); `/review` required plus `/advisor on` for High-risk turns only (second model, extra cost). A named human owner stays accountable for the outcome; agent approval never counts as human approval.

An unmatched file (no adjacent test, generated artifact, config without a validator) is treated conservatively: run the feature lane, or the full gate when the change is load-bearing.

## Rules

- Run the thing; output proves it. Exit-zero alone is not proof: state what was exercised and observed. Never report a check as passed unless its command was executed and its result was observed.
- Risk-proportional proof: Low stays on the affected lane; Medium adds the feature lane and `/review` when justified; High requires the full gate plus independent review, with a human owner accountable.
- Reuse `scripts/verify.sh` and existing CI; do not create a parallel verification system.
- A flaky check is a reliability defect, not permission to weaken the gate. Repeat the selector enough to assess; report flakes.
- Map each lane result to `PASS`, `FAIL`, `UNPROVEN`, `BLOCKED`, or `NOT EXECUTED`. Never merge these into one status. `UNPROVEN` is not ready.
- Report risk tier, exact commands and outcomes, files/checks covered, and what was deliberately not run and why.
