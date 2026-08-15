# Plan 003: Constrain client-supplied `first_seen_at` (no future, no ancient dates)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- functions/ src/scripts/audit.ts tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW/MED
- **Depends on**: plans/002-audit-replay-dedupe.md (already applied; same files)
- **Category**: security
- **Planned at**: commit `13ef792`

## Why this matters

Attribution (`landing_page`, `referrer`, `utm_*`, `first_seen_at`) is
collected client-side and stored on the lead row, then forwarded to the
founder's email. The server validates only shape and length — the comment in
`validate.ts` even says "values are stored, not trusted". The most abusive
field is `first_seen_at`: any caller can backdate it arbitrarily or set a
future date, corrupting channel-ROI decisions (the whole point of collecting
attribution). The lead table already has a server-side `submitted_at`
(created by Postgres), so first-seen is the only client clock that becomes
business data. This plan bounds it: reject future dates (with small clock
skew tolerance) and null out implausibly old ones, and documents the
"self-reported attribution" caveat where the data lands.

## Current state

- `functions/lib/validate.ts:117-142` — attribution block: shape checks
  only; `first_seen_at` is checked with `ISO_DATE_PATTERN`
  (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/`, defined ~line 25)
  and `LIMITS.firstSeenAt` (40 chars).
- `functions/api/audit.ts:23-45` — `toLeadRow` maps `first_seen_at:
  a.first_seen_at ?? null` into the row.
- `src/scripts/analytics.ts:44-58` — `captureAttribution` stores
  `first_seen_at: new Date().toISOString()` in sessionStorage.
- `supabase/migrations/20260811120000_leads.sql` — `first_seen_at
  timestamptz` (nullable) and `submitted_at timestamptz not null default now()`.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Boundary tests | `node --test tests/audit-function.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `functions/lib/validate.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `src/scripts/analytics.ts`, `src/scripts/audit.ts` — client capture stays
  as-is; the server is the trust boundary.
- `functions/api/audit.ts`, `functions/lib/contract.ts`, the migration.
- Any other file.

## Git workflow

- Commit once at the end: `fix(security): bound client-supplied first_seen_at (no future, no ancient)`
- Do NOT push or open a PR.

## Steps

### Step 1: Add temporal bounds in the attribution validation

In `functions/lib/validate.ts`, inside the `first_seen_at` check (in the
attribution block, currently shape+length only), add:

```ts
// first_seen_at is client-clock data — bound it: no future dates
// (5 min skew tolerance), nothing older than 180 days. Out-of-range
// values are dropped (nulled), never stored. Attribution remains
// self-reported (landing_page/referrer/utm_*), but timestamps that
// would corrupt funnel analysis are not trusted.
```

Implementation shape (match the existing `check` helper style in that
block): when `first_seen_at` is present, validate the ISO pattern + length
as today; then parse with `Date.parse`; if `isNaN` → `fail("first_seen_at",
"invalid_date")`; if `parsed > Date.now() + 5 * 60_000` →
`fail("first_seen_at", "invalid_date")`; if
`parsed < Date.now() - 180 * 24 * 3600_000` → drop the field (do not fail —
old-but-plausible sessions are normal); else keep it.

Also update the module docstring line about attribution ("shape-checked" →
"shape- and time-bounded").

**Verify**: `node --test tests/audit-function.test.mjs` still passes
(existing tests use plausible ISO dates).

### Step 2: Regression tests

In `tests/audit-function.test.mjs`, add tests for `validateAuditPayload`:

1. Future `first_seen_at` (`2099-01-01T00:00:00.000Z`) → `ok: false` with
   `fields.first_seen_at === "invalid_date"`.
2. Just-now value (`new Date().toISOString()`) → `ok: true`, value kept.
3. Ancient value (e.g. `2020-01-01T00:00:00.000Z`) → `ok: true` and
   `value.attribution.first_seen_at` is `undefined` (dropped).
4. Malformed value (`"yesterday-ish"`) → `ok: false` with
   `invalid_date` (this may already be covered — check; only add if absent).

Use the existing `validPayload()` helper and the pattern of the current
validation tests (search `validateAuditPayload` in that file).

**Verify**: `node --test tests/audit-function.test.mjs` → all pass with the new tests.

## Test plan

- New tests per Step 2 in `tests/audit-function.test.mjs`.
- Pattern: existing validation tests using `validPayload()` + field
  assertions on `result.fields`.

## Done criteria

- [ ] `grep -n "180 \* 24" functions/lib/validate.ts` → present (or equivalent constant)
- [ ] Future-dated `first_seen_at` rejected by a test; ancient one dropped by a test
- [ ] `node --test tests/audit-function.test.mjs` passes
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- The attribution block in `validate.ts` differs materially from the
  excerpt (e.g. the `check` helper structure changed).
- An existing test depends on storing an out-of-range `first_seen_at` — if
  so, report it; do not weaken the bound.

## Maintenance notes

- 5-minute skew tolerance covers honest client clocks; the 180-day floor
  covers long-lived sessions. Both are constants — keep them near the
  `ISO_DATE_PATTERN`.
- The Web3Forms email and the lead row now only ever carry bounded
  timestamps; `submitted_at` (server) remains the authoritative clock.
- If a real "first seen" server-side signal is ever wanted (e.g. via the
  Pages function's `cf-connecting-ip` + a store), it replaces this
  client field entirely — out of scope here.
