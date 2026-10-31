---
name: quick-fix
description: "Handle a small, clear, low-risk change with one targeted proof and no unnecessary planning."
whenToUse: "A localized defect or obvious correction where the cause is known, the change touches no trust, data, API, or architecture boundary, and one targeted check can prove the result."
---

# Quick fix

Use this for a localized defect, a small test addition, or an obvious correction. If the cause is uncertain, the change crosses a contract boundary, or the fix affects security, data, or public behavior, stop and use `spec` and `build` instead.

## Admit or escalate

Use this path only when all are true:

- the requested outcome and owning location are obvious;
- one low-risk behavior changes, normally in one or two files;
- no architecture, dependency, lockfile, public contract, migration, generated artifact, or external system is involved;
- no auth/access, money, secrets/privacy, upload/callback, destructive, concurrency, infrastructure, release, or deployment boundary is involved;
- one cheap targeted check can convincingly prove the change.

If any condition is false, state the reason in one sentence and switch to `/spec` + `/build`. Do not continue under the fast-path label.

## Procedure

1. Read the closest `AGENTS.md` and any document that owns the affected area. Locate the relevant code and its callers before editing.
2. Confirm the failure or requested behavior from code or an actual check. Do not guess the cause.
3. State the intended observable result in one sentence. No acceptance matrix, plan, todo list, or subagent.
4. Implement the smallest coherent fix in the working tree. Preserve unrelated behavior and user changes. Do not refactor opportunistically or add dependencies.
5. Add or update a test only when it would detect the defect or protect the intended behavior.
6. Run the narrowest real check that exercises the change. Use the project's actual command and record the command, working directory, exit code, and meaningful output. Do not run broad suites or the full gate unless project policy requires it.
7. Inspect the final diff and run `git diff --check`. Remove accidental edits, debug output, unused code, and unrelated formatting.
8. Solo default: leave the proven change in the working tree. Team delivery only on request: follow `docs/GIT_POLICY.md` and finish the scoped PR handoff through `scripts/deliver-pr.mjs`; delivery alone adds no broad gate or reviewer.

## Guardrails

- Do not add dependencies, change public interfaces, or perform broad renames as part of a quick fix.
- Do not weaken, skip, or delete a failing test to make the result green.
- Do not claim a check passed unless it ran. If the necessary tool is missing, report it as blocked.
- If the fix expands beyond the original scope, switch to `/build` and state why.

## Escalation boundaries

Escalate to `/build` when the change involves security or auth/access, money, secrets or privacy, data or schema changes, dependencies, public APIs, deployment or release work, more than two coordinated files, or a targeted check that fails twice. Do not relabel a risky change as a quick fix.

## Completion report

```text
Change: <what changed and where>
Checks: <command> (cwd, exit code) — <result>
Not verified: <unproven or unexecuted checks, or "none">
```
