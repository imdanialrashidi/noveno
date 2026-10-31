---
name: verify
description: "Discover and run the project's real checks, then report inspectable evidence without inventing commands."
whenToUse: "A change is ready for validation, a user asks whether it works, or existing evidence must be checked before completion."
---

# Verify

Verification is execution plus evidence. A plausible explanation is not a passed check.

## Discover the real commands

Read the closest `AGENTS.md`, README, contributor guide, CI workflow, task runner, and manifests. Use the commands those files define. Do not assume a language, package manager, framework, or test layout from another project.

This repository's canonical commands are documented in `AGENTS.md` and `docs/QUALITY.md`. In particular:

- the full gate is `bash scripts/verify.sh`;
- the project doc/branding/env check is `bash scripts/project-verify.sh`;
- the test suite is `npm test` (or a focused `node --test tests/<file>.test.mjs`);
- type/content validation is `npm run check`;
- the production build is `npm run build`;
- formatting is `npm run format:check`.

Run the build before structural tests when the evidence depends on fresh `dist/` output. A bare `npm test` on a clean checkout is not equivalent to the full gate.

If the repository defines no verification command for a surface, report that and state what you inspected. Do not invent a command and present it as the project's standard.

## Select checks

Choose the smallest set that covers the change, then widen for risk:

- **Affected:** the exact new test first, then the nearest existing tests for the changed behavior.
- **Feature:** the affected checks plus the project contract and a fresh build when the change is behavioral or user-facing.
- **Full:** `bash scripts/verify.sh` for broad, architectural, workflow, release, or high-risk changes.
- **Negative paths:** invalid input, denial, cancellation, timeout, empty state, permission failure.
- **Security-sensitive:** secret handling, authorization checks, injection surfaces, destructive operations.
- **Manual/runtime:** start the application and observe the user flow, inspect logs or output. Mark it unproven if you did not actually do it.
- **Browser-dependent:** use a browser capability only when the runtime provides one; a screenshot or source inspection alone does not prove interaction behavior.

## Risk tiers

Set the tier from actual scope and impact, not from author confidence:

- **Low:** docs/copy-only, internal comments, or a flag-gated additive change with no behavior change to existing paths. Lane: affected only; keep it lightweight.
- **Medium:** ordinary behavioral, cross-module, or architectural change. Lane: affected + feature; `/review` when non-trivial, user-facing, or production-bug work.
- **High:** security or auth/access, money, secrets/privacy, uploads/callbacks, schema/migration/deletion, public API, concurrency, infra/CI/CD, release workflow, or workflow policy. Lane: affected + feature + full gate (`bash scripts/verify.sh`), `/review` with a fresh-context `subagent` when available, and a named human owner. Agent approval never counts as human approval.

An unmatched file with no adjacent test or validator is treated conservatively: run the feature lane, or the full gate when the change is load-bearing.

## Execute and record

For every check, retain the exact command, working directory, exit code, and the part of the output that supports the conclusion. Do not pipe a command through something that hides its exit status; use the project's normal invocation and preserve failures.

Do not modify source code while acting as the verifier. If a check exposes a defect, return to `build` and rerun the affected checks afterward.

## Classify every check

- **passed** — the command ran and succeeded, with inspectable evidence.
- **failed** — the command ran and reported failure.
- **blocked** — a prerequisite (tool, service, credential, platform) prevented execution. Name it.
- **unproven** — a claim is supported only by inspection or reasoning, not by execution.
- **unexecuted** — the check was available or planned but did not run, was skipped, or was cancelled.

One check may be passed while another is blocked. Do not collapse the result into a single "all good" claim. A missing tool is not a pass. A skipped test is not a pass.

## Map evidence to acceptance

For each acceptance criterion, cite the check that covers it. If no check covers a criterion, say so. Distinguish a regression test that actually exercises the behavior from a test that merely imports the module.

## Report

```text
Verdict: <pass | fail | incomplete>

Checks:
| Check | Command | cwd | Exit | Result |
| --- | --- | --- | --- | --- |

Acceptance criteria:
- <criterion> — <evidence or gap>

Not executed / blocked:
- <check> — <reason>

Unproven:
- <claim> — <why inspection is insufficient>
```
