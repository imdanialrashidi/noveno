# Plan 019: Reconcile stale docs with shipped reality (PLAN, ARCHITECTURE, exec-plan)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- docs/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `13ef792`

## Why this matters

Three docs describe a repo that no longer exists: `docs/PLAN.md:11` says
"Stage 2 entry … No application code exists yet" and "no blog … at launch";
`docs/ARCHITECTURE.md:6` says "none implemented yet (bootstrap state)" and
lists Zaraz as current while its own pattern table says Zaraz is deferred;
`docs/exec-plans/active/noveno-launch.md` §3/§12 say the verification routes
have no `src/**` coverage yet. The actual repo ships the full launch scope
(13 pages, `/api/audit` + `/api/events` functions, Supabase + Turnstile +
Web3Forms wiring, blog with `/insights` → `/blog` 301s, two redesign passes)
and `.pi/verification.json` has an `app` route. AGENTS.md ranks docs below
implementation, but actively-wrong docs make every resume/handoff session
start from a false premise — worse than missing docs. This plan reconciles
status statements only; it does not rewrite history or re-litigate
decisions.

## Current state

- `docs/PLAN.md:11` — "Current stage: **Stage 2 entry — bootstrap and
  `/design` complete … No application code exists yet.**"
- `docs/PLAN.md:9` — non-goal "no blog or industry pages at launch"
  (the blog shipped: `src/pages/blog/`, `/insights` → `/blog` 301s in
  `public/_redirects`, `docs/BLOG.md` publishing guide).
- `docs/PLAN.md:22` — ledger row "Web Analytics + Zaraz … assumed | None
  yet" (Analytics Engine events path shipped via `functions/api/events.ts`;
  Zaraz was deferred).
- `docs/PLAN.md:89` — "Next bounded slice: Slice 1 … then Slice 2" (both
  committed per README "Repository state").
- `docs/ARCHITECTURE.md:5-9` — "## Current system — **Runtime/platform:
  none implemented yet (bootstrap state)**"; line ~15 "Cloudflare Zaraz
  (custom acquisition events)" listed as current; the same doc's pattern
  table (~line 33) says "Zaraz deferred"; `docs/exec-plans/active/noveno-launch.md`
  ~line 174 also says Zaraz deferred.
- `docs/exec-plans/active/noveno-launch.md:56,282` — "no application code
  exists"; §12 says verification routes have no `src/**` route
  (`.pi/verification.json` DOES have an `app` route — verify before
  editing).
- README.md and docs/BLOG.md are current (audited) — do not touch them.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Grep       | `grep -rn "no application code\|bootstrap state\|Stage 2 entry" docs/` | no matches after edits |
| Grep       | `grep -rn "Zaraz" docs/`     | all mentions consistent (deferred) |
| Check      | `npm run check`             | exit 0 (docs-only change; sanity) |

## Scope

**In scope**:
- `docs/PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/exec-plans/active/noveno-launch.md`

**Out of scope** (do NOT touch):
- `README.md`, `docs/BLOG.md`, `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, `docs/HARNESS.md` (current)
- Any code, config, or test file.

## Git workflow

- Commit once at the end:
  `docs: reconcile PLAN/ARCHITECTURE/exec-plan with shipped state`
- Do NOT push or open a PR.

## Steps

### Step 1: `docs/PLAN.md` — status, ledger, next slice

Edit precisely:

1. "Current stage" paragraph: replace the Stage 2 entry statement with the
   shipped state — Slices 1-2 committed and verified, plus the 2026-08-14
   founder-directed redesign and the 2026-09 product-led pass and 2026-10
   brand pass (per README "Repository state"); launch awaits founder
   provisioning (`docs/ops/setup-checklist.md`) and a preview-deploy smoke.
2. Non-goals line: adjust "no blog … at launch" to reflect that `/blog` is
   the small Markdown-first editorial surface that shipped (per
   `docs/BLOG.md` content policy); industry pages remain a non-goal.
3. Ledger: update the "Web Analytics + Zaraz" row to the shipped state
   (Web Analytics beacon + Analytics Engine via `/api/events` shipped;
   Zaraz deferred — Analytics Engine is the store; Web3Forms row already
   reflects the client-side decision — verify and leave as-is if current).
4. "Next bounded slice": replace with the current state (launch gate:
   provisioning + preview smoke per `docs/ops/setup-checklist.md`), not a
   new slice.
5. Stage gates 2-3: mark the exit evidence as achieved where the README
   and tests prove it (walking skeleton + vertical MVP are shipped); leave
   stages 4+ as pending launch. Do not invent evidence — only mark what
   the repo proves.

**Verify**: `grep -rn "no application code" docs/` → no matches.

### Step 2: `docs/ARCHITECTURE.md` — current system + Zaraz

1. "Current system" section: replace the "none implemented yet (bootstrap
   state)" runtime line with the implemented state: Astro 7 + TypeScript,
   statically rendered, deployed to Cloudflare Pages; no SSR; one Pages
   Function pair: `/api/audit` (submission boundary) and `/api/events`
   (Analytics Engine ingestion).
2. "Data stores": Supabase leads table shipped (migration
   `supabase/migrations/20260811120000_leads.sql`).
3. "External services": Web3Forms (email notification) shipped; Zaraz —
   **deferred everywhere** (fix the one line that lists it as current; the
   pattern table already says deferred — keep the table).
4. If the "Operational baseline" mentions "will need" items that shipped
   (`.env.example` variables, migration created), adjust the tense to
   "done at implementation" without changing the decisions.

**Verify**: `grep -n "bootstrap state" docs/ARCHITECTURE.md` → no matches;
`grep -n "Zaraz" docs/ARCHITECTURE.md` → every mention says deferred/not
used (read the lines to confirm).

### Step 3: `docs/exec-plans/active/noveno-launch.md` — status note

Do NOT rewrite the plan's body (it is the accepted historical plan).
Add a status note at the top (after the title/heading) and fix §3/§12
current-state sentences:

> **Status (2026-08, reconciled):** both slices are committed and verified
> — the app exists (`src/`, `functions/`, `supabase/migrations/`,
> `tests/`); `.pi/verification.json` has an `app` route. Launch awaits
> founder provisioning (`docs/ops/setup-checklist.md`). The steps below
> document the accepted plan; see README "Repository state" for the
> shipped reality.

Replace the specific "no application code exists" sentences with
cross-references to that note (or delete them if they are in verification
scope descriptions — read §3 and §12 first and make the minimal edit).

**Verify**: `grep -rn "no application code" docs/` → no matches.

### Step 4: Consistency sweep

**Verify**: `grep -rn "Stage 2 entry\|bootstrap state\|None yet" docs/PLAN.md docs/ARCHITECTURE.md` → only intentional mentions (e.g. historical ledger wording); read each remaining match and fix any that misstate reality. Then `npm run check` → exit 0 (docs don't affect it, but confirms no accidental config change).

## Test plan

- No tests — grep gates per step are the verification.

## Done criteria

- [ ] `grep -rn "no application code\|bootstrap state" docs/` → no matches
- [ ] `grep -rn "Zaraz" docs/` → consistent (deferred) across all three docs
- [ ] `docs/PLAN.md` current stage reflects shipped slices + pending launch gate
- [ ] `docs/exec-plans/active/noveno-launch.md` has the status note
- [ ] `npm run check` passes
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- A claim you are about to write contradicts something in the repo (e.g.
  `docs/ops/setup-checklist.md` says provisioning is done) — report the
  conflict; do not guess.
- The exec plan's §3/§12 sentences differ materially from the description —
  adapt minimally and note it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- These docs are read by resume/handoff flows (AGENTS.md source-of-truth
  order #3-5) — keep status statements in sync with README "Repository
  state" going forward; the README is the current-state anchor.
- If the founder completes provisioning, update PLAN.md stage gates 4-5
  next (internal alpha → external beta) with real evidence.
- Reviewer should scrutinize: no decisions re-litigated — only status
  tense/claims changed; the exec plan's body remains the accepted record.
