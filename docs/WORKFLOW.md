# Agent Workflow

This is the project's agent execution model. It adapts [dsh-workflow](https://github.com/imdanialrashidi/dsh-workflow) (v0.1) to Noveno: direct implementation remains the default, structure appears only where risk or uncertainty justifies it, and DSH provides the runtime rather than a custom plugin or command set.

`AGENTS.md` is the short entry point. This document owns routing, skill selection, and completion. [QUALITY.md](QUALITY.md) owns acceptance and evidence. [HARNESS.md](HARNESS.md) owns execution mechanics and recovery. [GIT_POLICY.md](GIT_POLICY.md) owns team delivery.

## Principles

1. **One primary writer.** A change has one writer responsible for the working tree. Delegated agents are for independent work such as review or investigation, not parallel edits to the same files.
2. **Plan only as much as needed.** Planning is a tool for complexity and risk, not a mandatory stage.
3. **Small, coherent changes.** Tie every change to explicit acceptance criteria and keep unrelated refactors out.
4. **Evidence over confidence.** Completion depends on executed checks and inspectable output, not a plausible narrative.
5. **Independent review where it adds value.** Review is risk-based and evidence-driven, not a ceremony.
6. **Repository-local context.** Instructions and project knowledge live with the code, stay concise, and have one owner per fact.
7. **Native DSH first.** Use DSH's instruction loading, skills, tools, permissions, and optional subagents. Do not build parallel orchestration.
8. **No silent authorization.** Workflow text never grants permission, bypasses an approval policy, or makes a sensitive action look routine.
9. **Repository independence.** The workflow does not assume a language, framework, package manager, or build system for other projects; this repository's commands are its own.

## Decision model

| Situation              | Path                                                                                                           | Required evidence                                              | Independent review                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| Small, clear, low risk | Inspect → implement → targeted verification → diff review (`/quick-fix`)                                       | A real check for the changed behavior and the inspected diff   | Not required                          |
| Normal feature         | Brief acceptance criteria → implement → verify → review (`/build`, `/verify`)                                  | Criteria mapped to checks; diff self-review                    | Optional                              |
| Complex change         | Inspect dependencies and architecture → concise plan → implement in bounded steps → verify each stage → review | Staged evidence; integration or contract checks where relevant | Recommended                           |
| High-risk change       | Spec → implement with negative-path tests → verify → security review → independent review                      | Negative paths, failure/rollback evidence, security review     | Required when a reviewer is available |
| Existing change review | Inspect the actual diff and context → review only (`/review`)                                                  | Findings with scenarios; no edits during review                | Optional second reviewer              |

Risk is set by the change, not by the author's confidence. A small diff in authentication, billing, migrations, CI, installers, workflow policy, or data deletion is still high risk.

### Small and low risk

Use `/quick-fix`. Locate the cause, make the smallest fix, run the narrowest real check, and inspect the diff. Do not create a specification or plan for a one-line correction.

### Normal feature

Use `/spec` only when the request leaves a real decision open. Otherwise state acceptance criteria in the response or task, then use `/build`, `/verify`, and `/review` when justified. The criteria need not be a separate file.

### Complex change

Inspect the relevant architecture, dependencies, and callers before editing. Write a concise plan with bounded steps and a verification point for each step. Use `/build`; verify each meaningful stage instead of waiting until the end. Keep the plan in the conversation unless the repository already treats plans as artifacts; durable plans live in `docs/exec-plans/active/` only when work crosses sessions.

### High risk

High risk includes authentication or authorization, secrets, payments or lead delivery, personal data, destructive operations, migrations, public API or schema changes, concurrency, dependency/runtime upgrades, CI or release automation, workflow policy, and sandbox or approval behavior.

For these changes:

- state the threat or failure being prevented;
- test the denied, invalid, cancelled, and rollback paths, not only the happy path;
- perform a security-focused review using `/review`;
- obtain independent review with a fresh-context `subagent` when available; otherwise report it as unexecuted;
- record accepted risks and their owners explicitly.

## Skills

DSH discovers the project skills in `.dsh/skills/`, injects a catalog into the session, and lets the model load one with the `skill` tool. A user can invoke a user-invocable skill with a `/name` token, for example `/quick-fix` or `/review`. These are DSH skill names, not generated command files.

| Skill                  | Use when                                       | Main output                                                             |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `/quick-fix`           | Small, clear, low-risk fix                     | Change, targeted check, diff review                                     |
| `/spec`                | Requirements or acceptance are unresolved      | Outcome, criteria, scope, constraints, verification strategy            |
| `/build`               | The change is ready to implement               | Coherent implementation and updated tests/docs                          |
| `/verify`              | Validation is needed                           | Executed checks with passed/failed/blocked/unproven/unexecuted statuses |
| `/review`              | A diff needs defect review                     | Evidence-backed findings and a bounded repair loop                      |
| `/test-design`         | Coverage or failure modes need designing       | Focused tests with meaningful failure detection                         |
| `/ship`                | Team delivery was explicitly requested         | Verified scoped PR or a precise delivery blocker                        |
| `/accessibility-audit` | WCAG 2.2 AA behavior is in scope               | Keyboard, semantics, focus, contrast, reflow evidence                   |
| `/web-performance`     | Loading or interaction performance is in scope | Repeatable before/after measurement                                     |
| `/technical-seo`       | Public discoverability changes                 | Rendered HTML, metadata, crawl, sitemap, structured-data evidence       |
| `/rtl-i18n`            | Direction or localization behavior is in scope | Locale, direction, bidi, formatting evidence                            |
| `/no-ai-slop`          | Substantive prose is being written or audited  | Concrete, natural copy with the writer's voice preserved                |

Load only the skill that matches the current phase. Loading every skill wastes context and encourages procedural theater. If no skill matches, follow the same phases manually.

## Verification and statuses

`/verify` discovers and runs the project's actual commands. Every check is reported as `PASS`, `FAIL`, `BLOCKED`, `UNPROVEN`, or `NOT EXECUTED`. The definitions and evidence requirements live in [QUALITY.md](QUALITY.md); the execution procedure is in [the verify skill](../.dsh/skills/verify/SKILL.md). The final report must not collapse these categories into "done".

A missing tool is `BLOCKED`, not `PASS`. A skipped check is `NOT EXECUTED`, not `PASS`. A claim supported only by inspection is `UNPROVEN`.

## Review and repair

Review looks for actionable defects with a concrete failure scenario and location. It is not a style pass. For risky changes, use a fresh-context DSH `subagent` for independent review and, where warranted, a separate validation pass for `BLOCKER` or `MAJOR` findings. The finding standard and bounded repair loop are in [QUALITY.md](QUALITY.md) and [the review skill](../.dsh/skills/review/SKILL.md). Repair is capped at two rounds; if unresolved findings remain, stop and reassess. Never weaken tests or suppress a valid finding to get a clean report.

## Context and project knowledge

A short entry point plus focused documents beats a giant instruction file. The project uses this structure:

| Document               | Owns                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `AGENTS.md`            | Standing instructions, commands, boundaries, and links to deeper documents |
| `docs/PRODUCT.md`      | Problem, users, outcomes, non-goals, and success signals                   |
| `docs/ARCHITECTURE.md` | System map, components, boundaries, invariants, and failure modes          |
| `docs/DESIGN.md`       | Interfaces, states, error behavior, compatibility, and design decisions    |
| `docs/QUALITY.md`      | Verification commands, test layers, risk areas, and definition of done     |
| `docs/WORKFLOW.md`     | This execution model and skill selection                                   |
| `docs/HARNESS.md`      | Runtime tools, context, recovery, and delivery mechanics                   |
| `docs/GIT_POLICY.md`   | Opt-in team delivery and the scoped PR helper                              |

Update the owning document in the same change when behavior, contracts, commands, or architecture change. Keep the entry point short and link to detail instead of duplicating it. Delete stale sections rather than letting them mislead the next agent.

## DSH integration

- Project instructions are loaded from the repository `AGENTS.md` chain.
- Project skills are `.dsh/skills/<name>/SKILL.md`; a same-name project skill shadows a user skill.
- The model gets a catalog and the `skill` tool. Explicit `/name` invocation injects the same skill body.
- Subagents are optional. Use `subagent` for a fresh context; do not use `subagent_fork` when independence matters because it inherits completed history.
- DSH is a developer preview. The project skills were verified against `0.2.1-rc.2`; re-check instruction paths and skill discovery after an upgrade, then update this document and the checks with evidence. Do not document an unverified feature as supported.

## Delivery

The default is solo work: implement, verify, and leave the proven change in the working tree. No commit, push, branch, or PR unless the current request explicitly asks for team delivery.

Team delivery follows [GIT_POLICY.md](GIT_POLICY.md) through the project-owned helper `scripts/deliver-pr.mjs`, which is a delivery capability rather than part of the DSH runtime. It commits only explicit files, pushes only the captured commit to the fixed `ai-changes` branch, and creates or updates the related PR. It never merges, deploys, force-pushes, or writes to `main`.

## Completion

A change is ready to report when:

- every acceptance criterion is met or explicitly reported as unmet;
- the actual checks have been run and their statuses are recorded;
- the diff has been reviewed and actionable findings are resolved or explicitly accepted;
- documentation owned by the change is updated;
- no known blocker is hidden behind a success summary.
