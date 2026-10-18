---
description: Independently evaluate the current change against acceptance and release risk
argument-hint: "[scope or acceptance contract]"
---

Review this working-tree change against its acceptance contract:

$ARGUMENTS

Do not edit files during review.

1. Read `AGENTS.md`, `docs/QUALITY.md`, and the relevant accepted goal or active execution plan. For user-facing work also read `docs/DESIGN.md`.
2. Inspect the actual diff and the narrow surrounding contracts/tests needed to understand it. For changed tests, check the plausible regression, gap in existing coverage, independent expected result, and faithful layer. Do not demand a new unit test when existing evidence proves the contract; flag implementation-mirroring or duplicate tests only with a concrete missed-defect scenario.
3. Check the diff against the stated intent, each acceptance criterion, relevant project contracts (`docs/QUALITY.md`, plus `docs/PRODUCT.md` / `docs/ARCHITECTURE.md` / `docs/DESIGN.md` where in scope), and the executed verification evidence actually observed — never the claimed result. Never state that a test or check passed unless its command was executed and its output was observed.
4. Classify the change Low / Medium / High risk from its actual scope and impact using `/skill:verify` (Low: docs/copy/flag-gated additive; Medium: ordinary behavioral or cross-module change; High: security-sensitive, auth/access, money, secrets/privacy, schema/migration/deletion, public API, concurrency, Git/CI/CD, or release-workflow change). Scale scrutiny and required proof to the tier; keep Low lightweight.
5. Apply the focused risk review in `docs/QUALITY.md`. When independent context materially improves this scope, delegate a bounded read-only reviewer pass through `task` subagents (plus a security-focused pass for changed trust/data/money boundaries) and, for High-risk work only, weigh `/advisor` notes (second model, extra cost); otherwise perform the same evidence-focused passes directly. On re-review after fixes, review only the new diff plus directly affected evidence — do not repeat resolved findings without new evidence.
6. Evaluate each required acceptance criterion as `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED`. A visually present but non-functional/stubbed accepted feature is `FAIL`.
7. For user-facing behavior, exercise the critical journey through the real application with the `browser` tool when the app can run safely. For a material visual change, grade the hard gates in `docs/DESIGN.md` from rendered desktop/mobile evidence. Browser evidence beats visual inference; without it, appearance criteria are `UNPROVEN`.
8. Report only evidence-backed acceptance failures or actionable regression/risk findings. Suppress speculative findings (no concrete failure scenario), duplicates, and purely stylistic findings outside `docs/QUALITY.md` and existing project conventions. Do not invent adjacent requirements.

For each finding include severity, exact `file:line` or symbol evidence, a concrete failure scenario, the impact if triggered, the smallest safe fix, and the proof check that would close it. Tag whether the finding is a regression introduced by this diff or `Pre-existing` (pre-existing issues are informational and never block release on their own).

Then include:

- **Risk tier:** Low / Medium / High + one-line scope reason
- **Acceptance:** criterion → PASS/FAIL/UNPROVEN/BLOCKED + evidence
- **Strengths:** only verified strengths that matter to release confidence
- **Verification observed:** exact commands run and results seen (never claimed-only); state what was not run
- **Files changed:** scoped list reviewed
- **Unresolved findings / UNPROVEN / BLOCKED:** explicit list; none means none
- **Verdict:** exactly one of `PASS`, `PASS WITH FIXES`, or `BLOCK`

`PASS` requires every required acceptance criterion to be proven and no unresolved BLOCKER/MAJOR finding.
