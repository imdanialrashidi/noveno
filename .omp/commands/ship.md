---
description: Verify the accepted change and deliver its scoped ai-changes pull request without merging or deploying
argument-hint: "[release scope or execution plan]"
---

Ship this change when its acceptance contract is proven. Scope:

$ARGUMENTS

Use only the standing PR-delivery scope in `docs/GIT_POLICY.md`. Do not add features, create per-task branches, write to main, merge a PR, release, deploy, publish packages, change production, or rewrite unrelated code. Respect explicit local-only or review-only requests.

1. Read `AGENTS.md`, `docs/QUALITY.md`, `docs/GIT_POLICY.md`, and the accepted goal/active execution plan when one exists. For user-facing work also read `docs/DESIGN.md`.
2. Inspect the full working-tree diff and reconstruct the required acceptance criteria.
3. Reject readiness if accepted functionality is stubbed, display-only, backed by fake persistence, or lacks required proof.
4. Confirm no secret, private specification, generated artifact, debug bypass, unrelated change, or accidental workflow-policy modification is included.
5. For meaningful user-facing changes, require real `browser`-tool evidence for the critical journey when the application can run safely. For material visual work, require named desktop/mobile/demanding-state evidence and all hard gates in `docs/DESIGN.md`.
6. Require an independent evidence-focused pass (`/review`; plus `/advisor on` for High-risk work only — second model, extra cost) for non-trivial user-facing, cross-module, production-bug, or material-regression changes, and for all High-risk changes (security-sensitive, auth/access, money, secrets/privacy, schema/migration/deletion, public API, concurrency, Git/CI/CD, release workflow). No unresolved BLOCKER/MAJOR finding may remain. On re-review, check only the new diff; do not repeat resolved findings without new evidence.
7. Load `/skill:verify`, classify risk Low / Medium / High from actual scope and impact, and run the matching lane — Low stays lightweight, High requires the full gate (`scripts/verify.sh` plus existing CI, never a duplicate system) with a human owner accountable. Run the full gate once more when the task class or final readiness requires it.
8. Map every required criterion to `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED` with exact evidence. `UNPROVEN` is not ready.
9. If an active execution plan exists, update its final evidence/status. Mark/move it complete only when all required criteria are proven.
10. Deliver the verified change through `scripts/omp-pr.mjs` on the existing `ai-changes` branch; create its PR or update the related PR by exact number. Verify remote SHA/PR and report CI separately. If blocked, preserve the diff/commit and state the exact recovery step; never force or reset.

Return:

- verdict: `READY`, `READY WITH KNOWN LIMITATIONS`, or `NOT READY`;
- risk tier (Low / Medium / High) with scope reason;
- acceptance criterion → evidence/status;
- exact verification commands actually run and observed results (never claimed-only), plus what was not run and why;
- independent review status and any unresolved findings;
- changed files and verified PR/commit status;
- known limitations, remaining risks, and explicit `UNPROVEN`/`BLOCKED` items (none means none);
- rollback/recovery note where relevant;
- remaining owner action: review and merge only when approved.
