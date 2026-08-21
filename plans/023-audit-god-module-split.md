# Plan 023: Split the 991-line audit client god module into focused modules

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- src/scripts/audit.ts src/data/audit.ts tests/audit-retry.test.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 020, 021, 025 (small timestamp/delivery fixes — land them first so the split doesn't stale)
- **Category**: tech-debt
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`src/scripts/audit.ts` is 991 lines and owns every concern of the acquisition journey: draft persistence (`sessionStorage`), attribution capture, Turnstile bridge lifecycle, 6-step rendering + progress, field validation UX, Web3Forms delivery (bounded retry), banner/online-offline handling, and the review summary. Every audit change touches it; reviewer cost and regression risk are highest here. The repo's convention is small framework-free modules (`src/scripts/analytics.ts:184`, `theme.ts:95`, `menu.ts:120` LOC each). Splitting by concern keeps the current architecture (no framework) and makes future audit work (e.g., server-side email `D-01`) a one-module change.

## Current state

Relevant files:
- `src/scripts/audit.ts` — 991 LOC god module (lines: see `wc -l` above)
- `src/data/audit.ts` — 6-step client contract (labels, validation, `AUDIT_STEPS`)
- `tests/audit-retry.test.mjs` — drives `initAudit` via fake DOM + scriptable fetch (~650 LOC of harness)

Structure of `src/scripts/audit.ts` as of `3e33265` (section comments are the split seams):

```ts
// 1. Draft persistence: readDraft, writeDraft, clearDraft, captureAttributionNow, createDraft, DRAFT_KEY/DONE_KEY (~60 LOC, :46-140)
// 2. TurnstileBridge class: script load, ensureRendered, getToken, invalidate, retry, syncTheme (~120 LOC, :145-260)
// 3. Validation UX: FIELD_ERROR_COPY, showFieldError, clearFieldError, validateStep (~80 LOC)
// 4. Main controller initAudit: handles wiring, field access, draft⇄DOM, step rendering, banner, progress, goBack/goNext, submit, deliverLead, onSuccess, buildWeb3FormsBody, safeText, fillSummary, event binding, boot (~600 LOC, :300-991)
// 5. Helpers outside controller: labelOf, fillSummary, safeText (label lookup + sanitization)
```

Public contract (must stay stable):
- `export function initAudit(config: AuditConfig): void` — imported at `src/pages/audit.astro:420` via `import { initAudit } from "../scripts/audit"`
- `export interface AuditConfig { turnstileSiteKey, web3formsKey, web3formsUrl }`
- No other exports are used outside tests (tests import `initAudit` only)

Repo conventions:
- Framework-free TS modules in `src/scripts/` — see `src/scripts/analytics.ts` (queue + beacon), `src/scripts/theme.ts` (aria-pressed + localStorage + matchMedia), `src/scripts/motion.ts` (IntersectionObserver + parallax) for file shape, JSDoc header, and export style.
- Tests in `tests/audit-retry.test.mjs` install globals (`sessionStorage`, `fetch`, `window.turnstile`) and drive the real state machine — keep them passing without harness changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass (audit-retry suite is the gate) |
| Targeted | `npm test -- --test-name-pattern="audit-retry\|Web3Forms"` | subset passes |
| Build | `npm run build` | 19 pages |

## Scope

**In scope** (only files you should modify):
- `src/scripts/audit.ts` — split into 3-4 modules, re-exporting `initAudit`
- New files: `src/scripts/audit/draft.ts`, `src/scripts/audit/turnstile.ts`, `src/scripts/audit/delivery.ts` (or similar names — choose one and document)
- `src/scripts/audit/index.ts` or keep `src/scripts/audit.ts` as barrel re-exporting from submodules (either is fine; barrel must preserve import path)
- `tests/audit-retry.test.mjs` — update only if import path changes (prefer zero test changes)

**Out of scope** (do NOT touch):
- `src/data/audit.ts` — step/option contract stays intact
- `functions/*` — server boundary unchanged
- `src/pages/audit.astro` import path — must keep working (barrel or original path)
- Any visual/design tokens, `src/scripts/analytics.ts`, `theme.ts`, `menu.ts`

## Git workflow

- Branch: `advisor/023-audit-god-module-split`
- Commit per step; conventional commits (e.g., `refactor(audit): ...`)
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Create the new module skeleton (no behavior change)

Create `src/scripts/audit/` directory with three modules, moving code **without** changing behavior:

1. `src/scripts/audit/draft.ts` — `DRAFT_KEY`, `DONE_KEY`, `Draft` interface, `readDraft`, `writeDraft`, `clearDraft`, `captureAttributionNow`, `createDraft`, `applyDraftToDom`, `saveValues`, `fillSummary` (attribution + submission_id stability preserved). Export the same symbols `src/scripts/audit.ts` used internally.

2. `src/scripts/audit/turnstile.ts` — `TurnstileBridge` class + `TURNSTILE_SCRIPT` constant + `declare global Window.turnstile` (move verbatim; fix relative imports for `effectiveTheme` from `../theme.ts`).

3. `src/scripts/audit/delivery.ts` — `buildWeb3FormsBody`, `deliverLead` (bounded 2-attempt fetch with `AbortSignal.timeout(10_000)`), `safeText`, `labelOf`/`joinedLabels` helpers. Keep `access_key` inclusion and receipt echo (plan 021) if that plan has landed; otherwise keep current shape and note `021` dependency. Export `deliverLead` and `buildWeb3FormsBody` for controller use.

Each new file should start with the same JSDoc header style as `src/scripts/audit.ts:1-15` (journey + draft + Turnstile + delivery semantics) scoped to its seam.

**Verify**: `npm run check` → exit 0 (new modules type-check even before rewiring)

### Step 2: Rewire the controller to import from the new modules

Rewrite `src/scripts/audit.ts` (or `src/scripts/audit/index.ts` if you chose a directory barrel) to:

1. Import from the three new modules instead of inlining them.
2. Keep `export function initAudit(config: AuditConfig)` with identical body, but delegate to imported helpers (draft read/write, `TurnstileBridge`, `deliverLead`).
3. Keep `Handles` interface, `FIELD_ERROR_COPY`, `showFieldError`/`clearFieldError`/`validateStep`, progress/banner rendering, `goBack`/`goNext`, `submit`/`onSuccess`, and event binding **inside the controller** (not extracted — that's UX state that belongs together). The split is at the I/O boundaries (storage, Turnstile, network), not at every function.

Import path stability: if you move `src/scripts/audit.ts` → `src/scripts/audit/index.ts`, add a barrel `src/scripts/audit.ts` that re-exports `initAudit` so `src/pages/audit.astro:420` keeps `import { initAudit } from "../scripts/audit"` without edit (preserve the diff).

**Verify**: `npm run check` → exit 0; `npm test -- --test-name-pattern="retry after"` → audit-retry subset passes

### Step 3: Ensure tests still drive the real module without harness changes

`tests/audit-retry.test.mjs` imports `initAudit` from `../src/scripts/audit.ts`. With the barrel, this import still resolves. No harness change should be needed. If you renamed the directory without a barrel, update the single import line in `tests/audit-retry.test.mjs:18` to `../src/scripts/audit/index.ts` — and assert `npm test` still passes.

Check that the fake-DOM harness (`buildAuditDom`, `makeTurnstileMock`, `installGlobals`) still sees the same globals (`sessionStorage`, `fetch`, `window.turnstile`, `MutationObserver`, `matchMedia`). No new global is introduced.

**Verify**: `npm test` → all 186 pass (3 skipped)

### Step 4: Build and verify no behavior change

**Verify**: `npm run build` → 19 pages complete; `grep -rn "initAudit" src/pages/audit.astro` still hits; `grep -rn "from.*audit" src/scripts/` shows only controller imports

Optional: `bash scripts/verify.sh` (full gate) — must not introduce new failures.

## Test plan

- No new tests required — existing `tests/audit-retry.test.mjs` is the behavioral contract. All of the following must keep passing:
  - `retry after a recoverable /api/audit network failure …`
  - `retry after a Turnstile script-load failure …`
  - `Web3Forms success: exactly one delivery POST …`
  - `Web3Forms failure (network): server validation success alone does NOT complete …`
  - `Web3Forms non-2xx and API { success: false } …`
  - `unconfigured (missing Web3Forms key) …`
  - `offline: …`, `server validation rejection surfaces …`, `2xx without validated is NOT success`, `abort timeout signal`, `draft restore …`
- If a behavior change is detected by any of these tests (e.g., draft lost, Turnstile reset count wrong), the split introduced a seam bug — fix the seam, not the test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; `tests/audit-retry.test.mjs` suite all pass without harness modification beyond one import line (if needed)
- [ ] `grep -rn "readDraft\|TurnstileBridge\|deliverLead" src/scripts/audit.ts` is empty — symbols live in `src/scripts/audit/*.ts`
- [ ] `src/scripts/audit/draft.ts`, `src/scripts/audit/turnstile.ts`, `src/scripts/audit/delivery.ts` exist and export the expected symbols
- [ ] `src/pages/audit.astro` still imports `initAudit` successfully (`npm run build` proves it)
- [ ] Total LOC per new module ≤ 350 (guide, not hard gate — but flag if any exceeds 500)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- The split requires changing `src/data/audit.ts` or `functions/*` to compile — wrong seam
- Any audit-retry test fails after the rewire and the failure is not explained by a missing barrel re-export (suggests behavior drift)
- `window.turnstile` mock in `tests/audit-retry.test.mjs:320` no longer reaches the new `TurnstileBridge` (import path / instantiation changed)
- You discover `initAudit` is imported anywhere besides `src/pages/audit.astro` and `tests/audit-retry.test.mjs` (search before splitting — unexpected coupling)

## Maintenance notes

- Future audit work (server-side email `D-01`, new steps, new fields) should land in the appropriate seam: storage in `draft.ts`, Turnstile in `turnstile.ts`, network in `delivery.ts`, UX in the controller. Do not re-consolidate.
- Reviewer should check that `safeText` (stripping `<` `>`) and `receipt` echo (021) still happen in `delivery.ts` — the email renders as HTML and lead values are client-controlled.
- Keep the controller's `Handles` and banner/progress handling co-located — splitting those further would create prop-drilling churn with no benefit.
