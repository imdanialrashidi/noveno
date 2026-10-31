# Quality Contract

Evaluator-facing quality bar for meaningful changes. Keep project-specific after the first real feature; do not turn it into a generic checklist dump.

## Release rule

A change is not complete because the code compiles or the happy-path check passes. Every accepted behavior must be implemented rather than stubbed, exercised at the appropriate layer (real run, not opinion), and supported by evidence.

A required criterion that is unproven is **not passed**.

## Functional completeness

For accepted scope:

- controls that imply behavior must actually perform that behavior;
- persistence must survive the lifecycle promised by the product;
- displayed state must come from the authoritative source rather than a convenient fake;
- required error, empty, loading, disabled, success, permission, retry, and recovery states must behave coherently;
- no accepted feature may be satisfied by a placeholder, TODO handler, mock response, display-only control, or hard-coded success path unless the contract explicitly says it is a prototype.

## Correctness

- Preserve domain invariants across success and failure paths.
- Validate external/untrusted data at boundaries.
- Handle retries, duplicate requests, time, rounding, ordering, partial failure, and concurrency where they are material to the changed behavior.
- A production bug should gain regression evidence when practical.
- Checks should assert behavior and contracts rather than implementation trivia.
- A new regression test should demonstrably fail on pre-fix behavior (or a safe focused mutation) when practical, then pass after the fix.
- Generated checks must build, pass reliably, add a distinct behavioral signal, and isolate relevant state; line coverage alone is not acceptance evidence.

`/test-design` owns the Test Value Gate — apply it before adding or materially changing tests. `No new test` is acceptable for behavior-neutral changes or behavior the suite already proves.

## Security and data integrity

For trust-boundary changes, apply the focused risk review below.

At minimum:

- authorization and ownership are enforced server-side;
- client-provided roles, prices, payment/subscription states, ownership, and permissions are never authoritative;
- secrets and sensitive data do not enter source, logs, screenshots, fixtures, prompts, or public artifacts;
- money/callback/state-transition operations are verified, idempotent, replay-aware, and auditable where applicable;
- schema/data changes have compatibility, rollback/recovery, and failure-path reasoning.

### Focused risk review

Review only the accepted scope and actual diff. Trace changed trust boundaries, input-to-sink data flows, state transitions, public contracts, dependencies, and operational behavior; check the actual controls and checks before reporting a finding.

Check only relevant failure paths: authorization/tenant isolation, injection and unsafe files/URLs, credential/session handling, payment/replay/idempotency, races and partial writes, timeout/cancellation/recovery, unbounded work, inaccessible/error states, dependency/CI mismatch, migration rollback. For High-risk scopes prefer `/review` with a fresh-context `subagent` when available; otherwise perform a direct evidence-focused pass and record independent review as unexecuted.

For each evidence-backed finding give severity, exact `file:line` or symbol, a concrete failure/attack scenario, the impact if triggered, why the current control is insufficient, whether it is a regression introduced by this diff or `Pre-existing`, the smallest safe fix, and a proof check. Suppress speculative findings (no concrete scenario), duplicates, and purely stylistic findings. Prefer a few actionable findings over speculative checklist output.

- **BLOCKER:** exploitable security, data loss/corruption, money/access violation, migration/deployment breakage, or a broken critical flow.
- **MAJOR:** likely user-visible correctness/reliability failure or substantial security/performance regression.
- **MINOR:** bounded defect or maintenance risk.
- **NIT:** optional clarity/style improvement; never a release blocker.

Return the acceptance evidence and one verdict: `PASS`, `PASS WITH FIXES`, or `BLOCK`. `PASS` requires proven required criteria and no unresolved BLOCKER/MAJOR. Use `/review` for the complete review procedure.

## User-facing quality

For rendered interfaces:

- exercise the critical journey in the real application with the runtime's browser capability when browser behavior matters and the capability is available;
- preserve keyboard access, visible focus, semantic controls, labels, contrast, touch targets, and reduced-motion behavior;
- check realistic data, long text, localization/RTL when relevant, and at least one narrow viewport for mobile-facing surfaces;
- follow the accepted `docs/DESIGN.md`; reuse existing design tokens/components when sound, change deliberately when the direction requires it;
- do not add explanatory copy that merely restates obvious UI;
- visual polish cannot compensate for missing interaction depth or broken behavior.

Default accessibility baseline when the product has not chosen a stricter target: WCAG 2.2 AA, text contrast ≥ 4.5:1 (3:1 large text), non-text UI/state contrast ≥ 3:1, reflow at 320 CSS px, usable at 200% text zoom with visible focus and meaning not carried by color alone.

## Reliability and performance

Apply only where relevant to the changed path:

- avoid unbounded reads/work, N+1 access, duplicate calls, uncontrolled concurrency, blocking hot paths;
- use explicit timeouts/cancellation/retries where the boundary requires them;
- preserve meaningful non-sensitive logs or diagnostics for critical transitions;
- performance claims require a reproducible baseline and after-measurement;
- a flaky check or intermittent runtime path is a reliability defect, not permission to weaken the gate.

For production web surfaces without accepted product-specific field budgets, target Core Web Vitals `good` at p75 segmented by mobile/desktop: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Before field data exists, require an accepted repeatable lab budget plus rollout checks; lab results are pre-production signals, not field proof.

## Maintainability and architecture

- Prefer existing project patterns and stable framework/platform primitives.
- Keep public interfaces small and backward-compatible unless a breaking change is accepted.
- Keep business rules separable from presentation/transport when the existing architecture supports it.
- New abstractions should solve more than one real current use case or remove a demonstrated risk/duplication.
- New dependencies require a concrete benefit over existing/platform capabilities — DSH already provides repository search, shell execution, web access, skills, and optional subagents; adding a package that duplicates them needs justification.
- Architecture invariants that matter repeatedly should be enforced mechanically with types, lint rules, structural tests, schemas, or CI rather than prose alone.

## Evidence hierarchy

Prefer stronger evidence when practical:

1. deterministic automated check of the accepted behavior;
2. real `bash`/test run, or browser exercise of the relevant journey when the runtime provides a browser capability;
3. type/lint/structural analysis and code inspection for invariant classes;
4. reproducible measurement for performance/reliability claims;
5. focused independent-evaluator inspection (`/review`) for aspects that cannot be automated economically.

A reviewer or subagent opinion alone is not proof. Never report a test or check as passed unless its command was executed and its result was observed.

## Evaluator rubric

Judge the accepted contract, not adjacent scope. For each criterion return one of:

- **PASS** — implementation and evidence satisfy the criterion;
- **FAIL** — evidence demonstrates incorrect/incomplete behavior;
- **UNPROVEN** — implementation may exist but adequate evidence is missing;
- **BLOCKED** — a genuine prerequisite prevents verification.

The overall task cannot be called complete while a required criterion is `FAIL` or `UNPROVEN`, or while a required independent review has an unresolved BLOCKER/MAJOR finding.

## Project-specific quality invariants — Noveno website

Confirmed rules for this project (source: `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, Master Spec §19/§50/§51/§61/§62). Enforce mechanically where a check already exists; future checks are listed under each rule.

1. **Persian-first, RTL-first.** Every page renders `fa` + `dir="rtl"`; no LTR leakage in layouts or copy. Mechanical check once the Astro app exists: structural test over built HTML.
2. **Static by default; no client UI framework.** No React/Vue/Svelte; interactivity only via Astro components and framework-free TS modules; no SSR. Mechanical check once the app exists: `package.json` dependency assertion + build output inspection.
3. **No fabricated proof.** Case studies/projects must be real; results evidence-backed (Spec §19, §21.7); demo/concept content must be visibly labeled; no fake testimonials/logos; no sales guarantees in copy. Check: content review step in `/review` plus copy fixtures in tests when content lands.
4. **Audit form is business-critical.** Server-side validation, abuse mitigation, no silent failure, no false success, attribution preserved; every accepted submission is delivered as **email via Web3Forms**, and the visitor sees success only after Web3Forms confirms acceptance (no database — 2026-10 email-only architecture, Spec §61–62 adapted). Check: function-level tests at implementation (defect-sensitive: must fail on pre-fix behavior) + client journey tests proving thank-you requires confirmed delivery.
5. **Secrets stay out of the repository.** `.env*` ignored except `.env.example` (names only, never values); credentials only in Cloudflare Pages secrets. Check: `bash scripts/verify.sh` secret scan + `scripts/check-project-contract.mjs` `.env.example` value scan (exists, run via `scripts/project-verify.sh`).
6. **Light/dark themes with system default, persisted override, no incorrect-theme flash; tokens from the accepted anchors in `docs/DESIGN.md`.** Check: browser theme-flash/contrast evidence via the runtime's browser capability when available.
7. **Accessibility baseline WCAG 2.2 AA** (keyboard, focus, labels, contrast 4.5:1/3:1, reduced motion, no color-only meaning) and **mobile-first** (320px reflow, tap targets, click-to-call). Check: browser QA gates.
8. **Performance is a product requirement**: static rendering, minimal JS, optimized self-hosted assets; CWV `good` targets pending an accepted lab budget. Check: lab measurement at build, RUM via Cloudflare Web Analytics after launch.
9. **No speculative infrastructure**: new dependencies/services need a concrete current benefit; Cloudflare free-tier compatibility where practical. Check: dependency review in `/review`.

Canonical commands:

- Full canonical gate: `bash scripts/verify.sh` (DSH workflow self-checks + secret scan, builds the project so structural tests run against a fresh `dist/`, then runs `scripts/project-verify.sh`, `npm run check`, and `npm test`; CI mirrors this in `.github/workflows/quality.yml`).
- Project doc/branding/contract checks: `bash scripts/project-verify.sh` (fast, static).
- Affected/feature lanes: `/verify` (exact new test first, then nearest existing tests by code reference; unmatched files use the feature lane or the full gate).
- Contract tests: `node --test tests/*.test.mjs` (project suite; structural tests assert a fresh `dist/` — run the full gate, not bare `npm test`, on a clean checkout).
- Workflow runtime: DSH, with project skills in `.dsh/skills/`; no workflow plugin, command pack, or extra package. Project instructions live in `AGENTS.md`; the execution model is `docs/WORKFLOW.md`.
- Browser QA: the runtime's browser capability when available; accessibility snapshots and DOM/console/network evidence first, screenshots under `.artifacts/` as reproducible artifacts. Deterministic browser tests stay separate from interactive exploration.

Do not invent quality targets that the product or repository has not accepted.
