---
name: ship
description: "Verify an accepted change and deliver its scoped ai-changes pull request without merging or deploying."
whenToUse: "The acceptance contract is proven and the user explicitly asked for team delivery via the ai-changes pull request; never for local-only or review-only work."
---

# Ship

Ship is the project-specific delivery step. It does not add product scope, create per-task branches, write to `main`, merge, release, deploy, publish packages, or mutate production.

## Before delivering

1. Read `AGENTS.md`, `docs/QUALITY.md`, `docs/GIT_POLICY.md`, and the accepted goal or active execution plan. For user-facing work, also read `docs/DESIGN.md`.
2. Confirm the current request explicitly asks for team delivery. "Open a PR", "deliver via ai-changes", or equivalent qualifies. Local-only, review-only, explanation-only, "do not commit", and "do not push" do not.
3. Inspect the full working-tree diff and reconstruct the acceptance criteria.
4. Reject readiness if accepted functionality is stubbed, display-only, backed by fake persistence, or lacks required proof.
5. Confirm no secret, private specification, generated artifact, debug bypass, unrelated change, or accidental workflow-policy modification is included.
6. For meaningful user-facing changes, require real browser/runtime evidence for the critical journey when the application can run safely. For material visual work, require named desktop, mobile, and demanding-state evidence and the hard gates in `docs/DESIGN.md`. Mark unobserved appearance criteria `UNPROVEN`.
7. Require an independent evidence-focused pass for non-trivial user-facing, cross-module, production-bug, or material-regression changes, and for all High-risk changes. Use `/review` with a fresh-context `subagent` when available; otherwise record independent review as unexecuted. No unresolved `BLOCKER`/`MAJOR` finding may remain.
8. Run `/verify` and the matching lane from `docs/QUALITY.md`. Low stays lightweight; High requires the full gate (`bash scripts/verify.sh`) and a human owner accountable. Run the full gate again when final readiness requires it.
9. Map every required criterion to `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED` with exact evidence. `UNPROVEN` is not ready.
10. If an active execution plan exists, update its final evidence and status. Mark or move it complete only when all required criteria are proven.

## Deliver

Follow `docs/GIT_POLICY.md` exactly. Use the reviewed helper from the repository root:

```sh
node scripts/deliver-pr.mjs prepare
node scripts/deliver-pr.mjs deliver --message "fix: accepted outcome" --title "Accepted outcome" --body-file .artifacts/deliver-pr.md --file <path>...
```

The helper commits only explicit files, pushes only the captured commit to `ai-changes`, and creates or updates the related PR. Never force, reset, bypass hooks, write to `main`, or merge automatically. If delivery is blocked, preserve the diff/commit and state the exact recovery step.

## Report

Return:

- verdict: `READY`, `READY WITH KNOWN LIMITATIONS`, or `NOT READY`;
- risk tier (`Low` / `Medium` / `High`) with a one-line scope reason;
- acceptance criterion → evidence/status;
- exact verification commands actually run and observed results, plus what was not run and why;
- independent review status and unresolved findings;
- changed files and verified PR/commit status;
- known limitations, remaining risks, and explicit `UNPROVEN`/`BLOCKED` items (none means none);
- rollback/recovery note where relevant;
- remaining owner action: review and merge only when approved.
