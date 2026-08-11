# Quality Contract

This file defines the evaluator-facing quality bar for meaningful changes. Keep it project-specific after `/bootstrap`; do not turn it into a generic checklist dump.

## Release rule

A change is not complete because the code compiles or the happy-path test passes. Every accepted behavior must be implemented rather than stubbed, exercised at the appropriate layer, and supported by evidence.

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
- Tests should assert behavior and contracts rather than implementation trivia.
- A new regression test should demonstrably fail on pre-fix behavior (or a safe focused mutation/equivalent independent characterization) when practical, then pass after the fix.
- Generated tests must build, pass reliably, add a distinct behavioral signal, and isolate relevant state; line coverage alone is not acceptance evidence.

## Security and data integrity

For trust-boundary changes, require the `risk-review` workflow.

At minimum:

- authorization and ownership are enforced server-side;
- client-provided roles, prices, payment/subscription states, ownership, and permissions are never authoritative;
- secrets and sensitive data do not enter source, logs, screenshots, fixtures, prompts, or public artifacts;
- money/callback/state-transition operations are verified, idempotent, replay-aware, and auditable where applicable;
- schema/data changes have compatibility, rollback/recovery, and failure-path reasoning.

## User-facing quality

For rendered interfaces:

- exercise the critical journey in the real browser when browser behavior matters;
- preserve keyboard access, visible focus, semantic controls, labels, contrast, touch targets, and reduced-motion behavior;
- check realistic data, long text, localization/RTL when relevant, and at least one narrow viewport for mobile-facing surfaces;
- follow the accepted `docs/DESIGN.md`; use existing design tokens/components when they remain sound and change them deliberately when the accepted direction requires it;
- do not add explanatory copy that merely restates obvious UI;
- visual polish cannot compensate for missing interaction depth or broken behavior.

Default accessibility baseline when the product has not chosen a stricter target:

- WCAG 2.2 AA;
- text contrast at least 4.5:1, or 3:1 for qualifying large text;
- non-text UI/state contrast at least 3:1 where WCAG requires it;
- reflow without loss of information/functionality at 320 CSS px where the content is not inherently two-dimensional;
- usable at 200% text zoom, with clear visible focus and meaning that does not depend on color alone.

### Visual excellence

For a new interface, redesign, launch surface, or explicitly high-aesthetic task, load `frontend-design` and evaluate the rendered result using its visual-quality rubric.

Require:

- a product-specific visual thesis and one restrained signature element;
- typography, palette, composition, geometry, media, and motion derived from the product/audience rather than interchangeable defaults;
- semantic tokens and coherent components without turning every section into the same card;
- mobile recomposition rather than simple shrinkage;
- real content and deliberately designed loading, empty, error, success, focus, selected, disabled, and permission states as relevant;
- one product/interaction browser pass and one independent studio/aesthetic pass;
- named desktop, mobile, and demanding-state evidence when the application can run.

Hard-gate failures cannot be offset by aesthetic scoring. The ordinary production craft threshold is 2.75/4 with no dimension below 2; an explicitly flagship surface requires 3.25/4 with every dimension at least 3. Any criterion that depends on rendered evidence is `UNPROVEN` when only code was inspected.

## Reliability and performance

Apply only where relevant to the changed path:

- avoid unbounded reads/work, N+1 access, duplicate calls, uncontrolled concurrency, and blocking hot paths;
- use explicit timeouts/cancellation/retries where the boundary requires them;
- preserve meaningful non-sensitive logs or diagnostics for critical transitions;
- performance claims require a reproducible baseline and after-measurement;
- a flaky test or intermittent runtime path is a reliability defect, not automatic permission to weaken the gate.

For production web surfaces without accepted product-specific field budgets, use current Core Web Vitals `good` thresholds as targets at the 75th percentile, segmented by mobile and desktop: LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1. Before field data exists, require an accepted repeatable lab budget, RUM instrumentation, and a staged-rollout check. Lab results are pre-production signals; do not present them as field/RUM proof.

## Maintainability and architecture

- Prefer existing project patterns and stable framework/platform primitives.
- Keep public interfaces small and backward-compatible unless a breaking change is accepted.
- Keep business rules separable from presentation/transport when the existing architecture supports it.
- New abstractions should solve more than one real current use case or remove a demonstrated risk/duplication.
- New dependencies require a concrete benefit over existing/platform capabilities.
- Architecture invariants that matter repeatedly should be enforced mechanically with types, lint rules, structural tests, schemas, or CI rather than prose alone.

## Evidence hierarchy

Prefer stronger evidence when practical:

1. deterministic automated test of the accepted behavior;
2. real browser/API/database exercise of the relevant journey;
3. type/lint/structural/static analysis for invariant classes;
4. reproducible measurement for performance/reliability claims;
5. focused independent-evaluator inspection for aspects that cannot be automated economically.

A reviewer or subagent opinion alone is not proof.

## Evaluator rubric

An evaluator should assess the accepted contract, not invent adjacent scope.

For each acceptance criterion return one of:

- **PASS** — implementation and evidence satisfy the criterion;
- **FAIL** — evidence demonstrates incorrect/incomplete behavior;
- **UNPROVEN** — implementation may exist but adequate evidence is missing;
- **BLOCKED** — a genuine prerequisite prevents verification.

Then inspect cross-cutting regression risk only where the diff makes it relevant.

The overall task cannot be called complete while a required criterion is `FAIL` or `UNPROVEN`, or while a required independent review has an unresolved BLOCKER/MAJOR finding.

## Project-specific quality invariants — Noveno website

Confirmed rules for this project (source: `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, Master Spec §19/§50/§51/§61/§62). Enforce mechanically where a check already exists; future checks are listed under each rule.

1. **Persian-first, RTL-first.** Every page renders `fa` + `dir="rtl"`; no LTR leakage in layouts or copy. Mechanical check once the Astro app exists: structural test over built HTML.
2. **Static by default; no client UI framework.** No React/Vue/Svelte; interactivity only via Astro components and framework-free TS modules; no SSR. Mechanical check once the app exists: `package.json` dependency assertion + build output inspection.
3. **No fabricated proof.** Case studies/projects must be real; results evidence-backed (Spec §19, §21.7); demo/concept content must be visibly labeled; no fake testimonials/logos; no sales guarantees in copy. Check: content review step in `/review` plus copy fixtures in tests when content lands.
4. **Audit form is business-critical.** Server-side validation, abuse mitigation, no silent failure, duplicate-submission handling, attribution preserved; every accepted submission persisted to Supabase and triggers email notification (Spec §61–62). Check: function-level tests at implementation (defect-sensitive: must fail on pre-fix behavior).
5. **Secrets stay out of the repository.** `.env*` ignored except `.env.example` (names only, never values); credentials only in Cloudflare Pages secrets. Check: `scripts/pi-doctor.sh` secret scan (exists) + `.env.example` value scan in `scripts/check-project-contract.mjs` (exists, run via `scripts/project-verify.sh`).
6. **Light/dark themes with system default, persisted override, no incorrect-theme flash; tokens from the accepted anchors in `docs/DESIGN.md`.** Check: browser theme-flash/contrast evidence per `browser-qa` at design/build.
7. **Accessibility baseline WCAG 2.2 AA** (keyboard, focus, labels, contrast 4.5:1/3:1, reduced motion, no color-only meaning) and **mobile-first** (320px reflow, tap targets, click-to-call). Check: browser QA gates.
8. **Performance is a product requirement**: static rendering, minimal JS, optimized self-hosted assets; CWV `good` targets pending an accepted lab budget. Check: lab measurement at build, RUM via Cloudflare Web Analytics after launch.
9. **No speculative infrastructure**: new dependencies/services need a concrete current benefit; Cloudflare free-tier compatibility where practical. Check: dependency review in `/review`.

Canonical commands (current bootstrap state; app commands added when the Astro project lands):

- Full canonical gate: `bash scripts/verify.sh` (runs `scripts/pi-doctor.sh --ci` + `scripts/project-verify.sh`; CI mirrors this in `.github/workflows/quality.yml`).
- Project doc/branding/contract checks: `bash scripts/project-verify.sh` (fast, static).
- Affected-change routing: `node scripts/verify-affected.mjs --file <path> [--plan]` (routes in `.pi/verification.json`; unmatched files fall back to the full gate).
- Harness/workflow tests: `node --test tests/*.test.mjs`.
- Install (harness): `./p` installs pinned Pi packages; app install (`npm install` or `pnpm install`) arrives with the Astro scaffolding.
- Browser QA: lazy Playwright MCP (`/mcp status`), screenshots under `.artifacts/playwright/`; deterministic browser tests separate from MCP exploration.

Do not invent quality targets that the product or repository has not accepted.
