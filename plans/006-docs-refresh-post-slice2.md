# Plan 006: Refresh the source-of-truth docs to post-Slice-2 reality

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- docs/ARCHITECTURE.md docs/PLAN.md docs/PRODUCT.md docs/QUALITY.md`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The three highest-ranked source-of-truth documents describe the repository
as if nothing is built, while Slices 1-2 are committed and verified
(120/120 tests, `bash scripts/verify.sh` green; see
`docs/exec-plans/active/noveno-launch.md` status block and `README.md`).
`AGENTS.md` ranks `PRODUCT.md` above `ARCHITECTURE.md` for conflict
resolution, so a stale PRODUCT.md can re-introduce Zaraz or re-litigate the
settled font decision; a stale PLAN.md can make a resuming agent re-run
Slice 1. These docs are "worse than missing" — they are actively wrong. This
plan updates ONLY status statements; every accepted decision stays intact.

## Current state

- `docs/ARCHITECTURE.md`:
  - line ~6: `- **Runtime/platform:** none implemented yet (bootstrap state). Accepted direction: **Astro + TypeScript, statically rendered**, deployed to **Cloudflare Pages**. No SSR.`
  - line ~7: `- **Main modules:** (planned) Astro pages per the launch IA (Spec §8.1), Astro components, framework-free TypeScript modules for interactive behavior, one narrowly scoped Cloudflare Pages Function for the audit-form submission boundary.`
  - lines ~40-45 (Operational baseline): `.env.example documents required variable names only (APP_ENV=development currently). The audit function will need named variables (Supabase URL/service key, email transport) added to .env.example and Cloudflare Pages secrets at implementation time` and `Migrations: Supabase schema for the lead model (Spec §35 fields) created at implementation; treated as a data-integrity change (needs risk review).`
- `docs/PLAN.md`:
  - line ~11: `- Current stage: **Stage 2 entry** — bootstrap and `/design` complete; the launch build plan is accepted in docs/exec-plans/active/noveno-launch.md (two slices: flagship site → acquisition flow & production integration). No application code exists yet.`
  - line ~20 (evidence ledger): the row `Astro + TS + static Cloudflare Pages, no client framework, Supabase + email via one Pages Function, Cloudflare analytics | confirmed (accepted) | Bootstrap prompt overrides | First build validates practicality`
  - line ~87: `- Goal: **Slice 1 — Flagship Website Experience** per docs/exec-plans/active/noveno-launch.md ...`
- `docs/PRODUCT.md`:
  - line ~46: `- External/payment providers: Supabase (lead persistence), email notification (transport chosen at implementation), Cloudflare Web Analytics/Zaraz. No payment processing.`
  - line ~61: `- Required product telemetry: Cloudflare Web Analytics (traffic/performance baseline) + Cloudflare Zaraz for custom acquisition events; attribution persisted with the lead record (accepted bootstrap override).`
  - line ~68 (Open product decisions): `- Persian font choice, hero visual, and all visual-system decisions — deferred to /design.`
- `docs/QUALITY.md` lines ~130-131: `- Mechanical check once the Astro app exists: ...` and ~146: `- app install ... arrives with the Astro scaffolding` — conditionals that are now resolved.
- Accepted facts to state instead (all verified):
  - Implemented: 12 static routes, `functions/api/audit.ts` + `functions/api/events.ts`, `supabase/migrations/20260811120000_leads.sql` (RLS, zero policies), `.env.example` with all 10 variable names, Web3Forms client notification gated behind 200, Analytics Engine `NOVENO_EVENTS` binding in `wrangler.jsonc`.
  - Decision record: **Zaraz deferred** (ARCHITECTURE.md line ~22; launch plan §5.8: "Zaraz is a tag manager, not a store; revisit only when a third-party destination is wanted") — PRODUCT.md's telemetry sentence must match this.
  - Font decision settled: Estedad + Vazirmatn (DESIGN §5, decision log §17; `package.json` + `public/fonts/`).
  - Remaining gates (do NOT claim completion): founder provisioning per `docs/ops/setup-checklist.md` + preview-deploy smoke; live Supabase/Web3Forms/Analytics-Engine evidence still UNPROVEN (no credentials in this environment) — mirror the launch plan's UNPROVEN list.

## Repo conventions to match

- `scripts/check-project-contract.mjs` enforces per-doc markers. The edit
  MUST preserve: PRODUCT.md markers `Noveno`, `Persian`, `RTL`, `audit`,
  `qualified audit requests`; ARCHITECTURE.md markers `Astro`,
  `TypeScript`, `Cloudflare Pages`, `Supabase`, `static` — and must NOT
  introduce lines that are exactly `- Runtime/platform:` or `- Main modules:`
  (the forbidden patterns match a line ENDING after the colon — keep content
  on the same line).
- `docs/ops/runbook.md`, `docs/ops/setup-checklist.md`, `README.md`, and
  `docs/exec-plans/active/noveno-launch.md` are already current — do not
  re-edit them.
- Keep documents short; match their existing bullet style and the doc's
  voice (plain, precise).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Contract check | `node scripts/check-project-contract.mjs` | exit 0, "Project contract passed" |
| Contract tests | `node --test tests/project-contract.test.mjs` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file docs/ARCHITECTURE.md` | routes (workflow-contract/project-contract) |

## Scope

**In scope** (the only files you should modify):
- `docs/ARCHITECTURE.md`
- `docs/PLAN.md`
- `docs/PRODUCT.md`
- `docs/QUALITY.md`

**Out of scope** (do NOT touch):
- The invariants, chosen-patterns table, rejected-complexity list, or any
  accepted decision in these docs — only status/state statements change.
- `docs/exec-plans/active/noveno-launch.md` — its status block is current;
  the `UNPROVEN` list there is the canonical remaining-gates record.
- `README.md`, `docs/ops/*`, `CHANGELOG.md`.

## Git workflow

- Branch: `improve/006-docs-refresh`
- Commit message style (match the repo): `docs: refresh ARCHITECTURE/PLAN/PRODUCT/QUALITY to post-Slice-2 reality` — one commit; if you prefer separate commits per file, follow the same style.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: ARCHITECTURE.md — replace the bootstrap-state intro

Rewrite the "Current system" section so it describes what exists, keeping
the same structure and markers:

```markdown
## Current system
- **Runtime/platform:** implemented — **Astro + TypeScript, statically rendered**,
  deployed to **Cloudflare Pages** (free-tier-compatible). No SSR.
- **Main modules:** the launch IA (Spec §8.1) is implemented: Astro pages and
  components, framework-free TypeScript modules for interactive behavior, and
  two narrowly scoped Cloudflare Pages Functions — `functions/api/audit.ts`
  (the audit-form submission boundary) and `functions/api/events.ts`
  (acquisition events → Analytics Engine).
- **Data stores:** Supabase — lead persistence for audit submissions
  (`supabase/migrations/20260811120000_leads.sql`: `public.leads`, RLS with
  zero policies). No other database.
- **External services:** email notification on audit submission (Web3Forms,
  client-side, gated behind the function's 200); Cloudflare Web Analytics
  (baseline traffic/performance) and Analytics Engine `NOVENO_EVENTS`
  (custom acquisition events); WhatsApp/Telegram/phone/email as contact
  channels — no third-party integration code required.
- **Deployment topology:** static assets on Cloudflare Pages CDN; the audit
  and events functions attached to the same project; Pages secrets for
  credentials (`wrangler.jsonc` commits the `NOVENO_EVENTS` binding and
  `nodejs_compat`). Free-tier-compatible.
```

Then update the "Operational baseline" bullets from future-conditional to
done-with-references:

- Configuration/secrets: `.env.example` documents the required variable
  names (build-time publics + Pages secrets); real values are configured in
  Cloudflare Pages project settings, never committed. See
  `docs/ops/setup-checklist.md`.
- Migrations: the launch lead schema is committed
  (`supabase/migrations/20260811120000_leads.sql`); applied by the founder
  during provisioning; future migrations are additive-only (see
  `docs/ops/runbook.md`).
- Backup and tested restore, logging/monitoring, rollback: see
  `docs/ops/runbook.md` (weekly export cadence, outcome-code-only logs,
  Pages redeploy rollback).

**Verify**: `node scripts/check-project-contract.mjs` → exit 0; `node --test tests/project-contract.test.mjs` → pass.

### Step 2: PLAN.md — advance the stage and the ledger

1. Replace the "Current stage" line with:
   `- Current stage: **post-Slice-2, pre-launch** — flagship site and
   acquisition flow (Slices 1-2 of docs/exec-plans/active/noveno-launch.md)
   are committed and verified (npm run check 0 errors; npm test 120/120;
   bash scripts/verify.sh green). Remaining gates: founder provisioning
   (docs/ops/setup-checklist.md) and a preview-deploy smoke; live
   Supabase/Web3Forms/Analytics-Engine evidence is still UNPROVEN (no
   credentials in this environment — see the launch plan's UNPROVEN list).`
2. Update the evidence-ledger row for the Astro stack: change the "Next
   test / decision" cell from `First build validates practicality` to
   `Validated by the Slice 2 build (npm run check/build/test green) — live
   evidence pending provisioning`.
3. Replace the "Next bounded slice" goal with the provisioning step:
   `- Goal: founder provisioning per docs/ops/setup-checklist.md
   (Supabase, Turnstile, Web3Forms, Pages env + NOVENO_EVENTS binding),
   then a preview-deploy smoke exercising the /audit journey end-to-end
   (runbook release checklist), then promote to production.`
4. Keep stage gates 3-8 as post-launch gates (do not edit them).

**Verify**: `node scripts/check-project-contract.mjs` → exit 0.

### Step 3: PRODUCT.md — fix the telemetry/provider sentences and the decisions list

1. Line ~46, change `Cloudflare Web Analytics/Zaraz` to
   `Cloudflare Web Analytics (baseline) + Analytics Engine via
   functions/api/events.ts (custom acquisition events)`.
2. Line ~61, replace the sentence with:
   `- Required product telemetry: Cloudflare Web Analytics (traffic/performance baseline) + Analytics Engine via functions/api/events.ts for custom acquisition events (audit_started, audit_step_completed, audit_submitted, CTA/contact clicks); attribution persisted with the lead record. Zaraz is deferred until a third-party destination is explicitly wanted (accepted decision, ARCHITECTURE.md).`
3. Line ~68, replace the deferred-font bullet with:
   `- Hero visual and remaining visual-system fine-tuning — font choice (Estedad + Vazirmatn) and theme tokens are settled in docs/DESIGN.md.`

**Verify**: `node scripts/check-project-contract.mjs` → exit 0.

### Step 4: QUALITY.md — de-conditionalize the resolved checks

Find the `once the Astro app exists` / `arrives with the Astro scaffolding`
phrases (lines ~130-131 and ~146) and rewrite them as current statements
pointing at the existing artifacts (`tests/structural.test.mjs`,
`tests/seo-contract.test.mjs`, `npm run check`, the dependency assertion in
`tests/project-contract.test.mjs`). Keep every invariant sentence intact.

**Verify**: `node scripts/check-project-contract.mjs` → exit 0; `grep -rn "once the Astro app exists\|arrives with the Astro scaffolding" docs/` → no matches.

### Step 5: Full verification

**Verify**: `bash scripts/verify.sh` → exit 0. Also confirm the four docs
still contain the required markers from `scripts/check-project-contract.mjs`
(PRODUCT.md: `Noveno`, `Persian`, `RTL`, `audit`, `qualified audit
requests`; ARCHITECTURE.md: `Astro`, `TypeScript`, `Cloudflare Pages`,
`Supabase`, `static`; PLAN.md: `Noveno`, `audit`; QUALITY.md: `Noveno`,
`RTL`, `WCAG 2.2 AA`).

## Test plan

- No new tests. The existing `tests/project-contract.test.mjs` +
  `scripts/check-project-contract.mjs` ARE the regression guard for this
  plan (they fail red if the edits drop required markers or reintroduce
  template placeholders).
- Manual check: `grep -n "Zaraz" docs/PRODUCT.md` → only the deferred-
  decision sentence remains; `grep -n "none implemented yet\|No application code exists" docs/` → no matches.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node scripts/check-project-contract.mjs` exits 0
- [ ] `node --test tests/project-contract.test.mjs` exits 0
- [ ] `bash scripts/verify.sh` exits 0
- [ ] `grep -rn "none implemented yet\|No application code exists yet\|Zaraz for custom acquisition events" docs/ARCHITECTURE.md docs/PLAN.md docs/PRODUCT.md` → no matches
- [ ] `grep -n "Zaraz is a tag manager" docs/exec-plans/active/noveno-launch.md` → still present (the deferred decision is not deleted anywhere)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The docs' content at the cited lines doesn't match the excerpts (they may
  have been edited — reconcile, don't overwrite other people's edits).
- `check-project-contract.mjs` fails after the edit in a way the steps
  don't explain (report the exact error; do not weaken the checker).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The launch plan's `UNPROVEN` list is the canonical record of what remains
  before launch — after provisioning + smoke, PLAN.md's stage line should
  be advanced again (and this plan's step 2 phrasing revisited).
- Keep the marker requirements in `scripts/check-project-contract.mjs` in
  mind for every future doc edit: the checker is deliberately strict.
- If Zaraz ever becomes wanted (per the accepted trigger: "a third-party
  destination is explicitly wanted"), PRODUCT.md's telemetry sentence and
  ARCHITECTURE.md's chosen-patterns row must change TOGETHER.
