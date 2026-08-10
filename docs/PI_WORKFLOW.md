# Pi Workflow Architecture

## Objective

Optimize for high-quality, production-safe vertical slices with end-to-end autonomy on modest local hardware.

The workflow deliberately avoids a large agent organization. Quality comes from acceptance clarity, agent-legible tools, focused context, independent evaluation, deterministic constraints, and executable evidence—not from maximizing the number of agents or skills.

## Core loop

```text
intent
→ task classification
→ acceptance contract
→ just-in-time discovery
→ one primary writer
→ targeted verification
→ independent evaluator(s) where justified
→ bounded repair
→ feature/full gate
→ acceptance → evidence report
→ task-branch delivery when in scope
```

For long-running work:

```text
active execution plan
→ incremental progress
→ structured handoff
→ fresh context
→ /resume
```

## Layers

### 1. Always-loaded map: `AGENTS.md`

`AGENTS.md` stays intentionally small. It provides the mission, source-of-truth order, task classes, acceptance shape, context discipline, hard stops, and definition of done, then routes the agent to deeper material only when needed.

### 2. Detailed playbook: `docs/HARNESS.md`

Loaded for non-trivial, repeated-failure, complex, or multi-session work. It defines acceptance contracts, just-in-time discovery, evaluator/repair loops, failure recovery, execution-plan handoff, quality ratchets, and harness evaluation.

### 3. Quality contract: `docs/QUALITY.md`

Defines evaluator-facing rules and project-specific quality invariants after `/bootstrap`. Accepted behavior must be functional and proven; placeholders, fake persistence, or display-only controls do not satisfy functional criteria.

### 4. Product design contract: `docs/DESIGN.md`

Stores the accepted product-specific visual thesis, signature element, semantic tokens, type/composition system, states, motion, responsive transformation, content voice, and screen-level proof expectations.

### 5. Parent execution policy: `.pi/APPEND_SYSTEM.md`

Routes task classification, bounded evaluator use, failure recovery, skill/tool routing, browser work, and final evidence reporting without duplicating the full playbook.

### 6. On-demand skills

- `verification-routing` — targeted, affected, feature, and full verification lanes;
- `test-design` — behavior-oriented tests and defect sensitivity;
- `risk-review` — correctness, data, security, reliability, performance, migration, and operational review;
- `browser-qa` — low-resource browser, interaction, accessibility, responsive, and visual verification;
- `frontend-design` — brief-specific visual direction, anti-template implementation, hard gates, and studio review.

### 7. User workflows

The prompt layer provides `/bootstrap`, `/discover`, `/design`, `/spec`, `/adr`, `/build`, `/test`, `/build-ui`, `/design-review`, `/plan`, `/review`, `/release-plan`, `/ship`, `/incident`, `/handoff`, and `/resume`.

### 8. Durable complex-task state

Use `docs/exec-plans/` only when todo/chat state is not durable enough. Plans capture accepted criteria, verified current state, decisions, evidence, risks, and the smallest next action. They are not transcripts.

### 9. Tool interface

The launcher exposes a deliberately small tool surface:

- repository read/edit/bash/search primitives;
- `subagent` for bounded independent contexts;
- `todo` for visible multi-step state;
- LSP for semantic code intelligence;
- `doc_search_*` for version-sensitive documentation;
- `web_search` and `web_fetch` for current external evidence;
- `mcp` as a compact lazy proxy for browser tools.

There is no delegated image-analysis extension or secondary image-model tool in the default workflow. Browser QA relies on accessibility snapshots, DOM/geometry/state inspection, console/network evidence, deterministic browser tests, and saved screenshots as reproducible artifacts. With a text-only primary, purely appearance-dependent criteria remain `UNPROVEN` unless the operator explicitly switches the primary model to one that can inspect images.

### 10. Deterministic guardrails

The safety extension reduces accidental high-blast-radius actions while keeping normal trusted repository work autonomous. The optional strict/container path is for cases that need a tighter boundary. Prompt instructions shape behavior; guardrails limit blast radius; project trust is not an operating-system sandbox.

## Acceptance-driven execution

For Standard or larger work, define 3–7 observable criteria and the proof required for each before implementation. Planning, implementation, review, browser QA, verification, and final reporting all target the same contract.

For a bug, prefer evidence of the failure before the fix. For performance, capture a baseline. For UI, exercise the actual critical journey. For visually significant UI, evaluate product/interaction hard gates first and treat appearance-only judgments as proven only when the active model can actually inspect the rendered artifact.

## Evaluator-optimizer loop

Independent evaluation is reserved for work where it has measurable value: non-trivial user-facing behavior, cross-module changes, production bug fixes, material regression risk, and high-risk data/security/money changes.

Default to at most two evaluator/repair rounds. If the same loop fails twice without new evidence, reassess the contract or root cause instead of repeating it.

## Failure recovery and context resets

If the same approach fails twice without new evidence, preserve the exact failure, form competing hypotheses, and gather the cheapest discriminating observations.

Compaction is useful for a coherent continuing task. A structured handoff plus fresh context is preferred when stale hypotheses, long tool history, or session boundaries make the old context harmful.

## Progressive disclosure and context

Preferred context order:

1. accepted intent and repository map;
2. exact symbols/tests/files;
3. local semantic/type evidence;
4. project docs;
5. version-matched official docs;
6. current external evidence only when necessary.

## Mechanical quality ratchet

When a defect class repeats, prefer encoding the fix in the environment:

1. regression test;
2. type/schema/boundary validation;
3. lint or structural rule;
4. clearer project API/helper;
5. focused documentation;
6. specialized skill;
7. more always-loaded prompt text only as a last resort.

## Verification strategy

### Targeted

Run exact tests, reviewed affected routes, relevant static checks, and the affected browser spec while implementing.

### Feature

Run the feature-level static/unit/integration/build/browser evidence once after the bounded slice.

### Full

Run the canonical repository gate once for final delivery or when the risk class requires it.

Interactive reviewer/browser output is evidence, not a substitute for executable tests when those are practical.

## Harness evaluation

Evaluate harness changes on realistic repository tasks using acceptance success, repair rounds, tool errors, wall-clock duration, token/context growth, unnecessary broad reads, regressions caught before handoff, user interventions, and local resource use where relevant.

A sophisticated harness component that does not improve representative outcomes should be removed.

## Intentionally excluded

- parallel write-capable agent swarms;
- vector memory by default;
- delegated image-analysis agents/extensions in the default workflow;
- repeated full-suite testing during implementation;
- a second specification framework;
- marketplace-wide skill packs;
- unbounded autonomous evaluation loops.
