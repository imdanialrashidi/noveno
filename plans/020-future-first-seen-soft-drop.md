# Plan 020: Drop future first_seen_at instead of rejecting the submission

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- functions/lib/validate.ts tests/audit-function.test.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

A legitimate visitor whose device clock is >5 minutes fast is blocked with `400 validation` (`attribution.first_seen_at: invalid_date`) and cannot complete the audit. The 180-day-old timestamp case already drops the field gracefully; the future case should too. Client clocks drift (Iranian mobile networks, manual settings) and attribution timing must never be a submission gate — the email's `first_seen_at` is self-reported anyway. Fix is a 2-line change + test correction.

## Current state

Relevant files:
- `functions/lib/validate.ts` — server-side attribution validation (lines 158-175)
- `tests/audit-function.test.mjs` — pins the current reject behavior (line ~182)

Excerpt — `functions/lib/validate.ts:158-181` as of `3e33265`:

```ts
      const firstSeen = str(attributionRaw.first_seen_at);
      if (firstSeen !== undefined) {
        // first_seen_at is client-clock data — bound it: no future dates
        // (5 min skew tolerance), nothing older than 180 days. Out-of-range
        // values are dropped (nulled), never stored. Attribution remains
        // self-reported (landing_page/referrer/utm_*), but timestamps that
        // would corrupt funnel analysis are not trusted.
        if (firstSeen.length > LIMITS.firstSeenAt) fail("attribution.first_seen_at", "too_long");
        else {
          const parsed = Date.parse(firstSeen);
          if (!ISO_DATE_PATTERN.test(firstSeen) || Number.isNaN(parsed)) {
            fail("attribution.first_seen_at", "invalid_date");
          } else if (parsed > Date.now() + FIRST_SEEN_MAX_SKEW_MS) {
            fail("attribution.first_seen_at", "invalid_date");
          } else if (parsed >= Date.now() - FIRST_SEEN_MAX_AGE_MS) {
            attribution.first_seen_at = firstSeen;
          }
          // else: older than 180 days — an old-but-plausible session, drop the field
        }
      }
```

Constants at `functions/lib/validate.ts:28-30`:

```ts
const FIRST_SEEN_MAX_SKEW_MS = 5 * 60_000;
const FIRST_SEEN_MAX_AGE_MS = 180 * 24 * 3600_000;
```

Failing test excerpt — `tests/audit-function.test.mjs` (future-dated case):

```ts
test("future-dated first_seen_at is rejected (client clocks may not lie forward)", () => {
  const result = validateAuditPayload(
    validPayload({ attribution: { ...validPayload().attribution, first_seen_at: "2099-01-01T00:00:00.000Z" } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fields["attribution.first_seen_at"], "invalid_date");
});
```

Repo conventions:
- Validation helpers live in `functions/lib/validate.ts` — pure, unit-tested, no I/O. See `functions/lib/normalize.ts` and `functions/lib/contract.ts` for pattern.
- Tests use `node:test` (`node --test tests/*.test.mjs` via `npm test`). Assert with `node:assert/strict`. Follow existing `tests/audit-function.test.mjs` structure.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0, no errors |
| Tests | `npm test` | 189 tests pass (3 skipped network-gated) |
| Targeted | `npm test -- --test-name-pattern="first_seen_at"` | related subset passes |
| Build | `npm run build` | 19 pages, no errors |

## Scope

**In scope** (only files you should modify):
- `functions/lib/validate.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `functions/api/audit.ts` — trust boundary wiring unchanged
- `src/scripts/audit.ts` — client attribution capture unchanged
- Any other attribution handling (landing_page, referrer, utm_*)
- `public/_headers`, `wrangler.jsonc`, `docs/*`

## Git workflow

- Branch: `advisor/020-future-first-seen-soft-drop`
- Commit per step; message style: conventional commits (e.g. `fix(validate): ...` — see `git log --oneline` examples: `fix(build): ...`, `fix(security): ...`)
- Do NOT push or open a PR unless operator instructed

## Steps

### Step 1: Change future first_seen_at from fail to soft-drop

In `functions/lib/validate.ts`, change the future-skew branch from `fail` to a silent drop (same as the 180-day-old branch). Target shape:

```ts
          } else if (parsed > Date.now() + FIRST_SEEN_MAX_SKEW_MS) {
            // Future-dated beyond skew tolerance — drop the field, never
            // reject the submission (client clocks drift; attribution is
            // self-reported). Mirrors the ancient-timestamp branch below.
          } else if (parsed >= Date.now() - FIRST_SEEN_MAX_AGE_MS) {
```

Do NOT change the `too_long` or `invalid_date` (unparseable/non-ISO) branches — those remain rejections. Only the future-skew branch becomes a drop. Keep the comment explaining why.

**Verify**: `npm run check` → exit 0

### Step 2: Update tests to pin the new behavior (drop, not reject)

In `tests/audit-function.test.mjs`:

1. Rename/replace the test `"future-dated first_seen_at is rejected …"` to assert the new behavior:
   ```ts
   test("future-dated first_seen_at is dropped, not stored (clock skew tolerance)", () => {
     const result = validateAuditPayload(
       validPayload({ attribution: { ...validPayload().attribution, first_seen_at: "2099-01-01T00:00:00.000Z" } }),
     );
     assert.equal(result.ok, true);
     if (result.ok) assert.equal(result.value.attribution.first_seen_at, undefined);
   });
   ```

2. Keep the existing ancient-timestamp dropped test (`"ancient first_seen_at is dropped …"` at ~2020-01-01) — it should still pass unchanged.

3. Keep the just-now test (`"just-now first_seen_at is accepted and kept"`).

4. Optionally add a boundary test: `Date.now() + 4min` should be kept, `Date.now() + 6min` should be dropped (not rejected). This proves the 5-min window is soft, not hard.

**Verify**: `npm test` → all pass (186 pass, 3 skipped). If the old future-reject test still fails, the file was not updated correctly — fix it.

### Step 3: Run full gate

**Verify**: `npm run build` → 19 pages complete; `bash scripts/verify.sh` if available (optional, but must not introduce build break).

## Test plan

- New/updated tests in `tests/audit-function.test.mjs`:
  - `future-dated first_seen_at is dropped, not stored` — 2099 date → `result.ok === true`, `first_seen_at === undefined`
  - Boundary: `now + 4min` kept, `now + 6min` dropped (both `ok === true`)
  - Existing tests unchanged: malformed ISO rejected, `too_long` rejected, ancient dropped, just-now kept
- Use `tests/audit-function.test.mjs` as pattern — see neighboring `first_seen_at` tests for structure
- Verification: `npm test` → all pass, including the 3 new assertions

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; future-dated timestamp no longer produces `fields["attribution.first_seen_at"] === "invalid_date"`
- [ ] `grep -n "invalid_date" functions/lib/validate.ts` shows only the `too_long`/unparseable branches, not the future-skew line
- [ ] `grep -n "2099" tests/audit-function.test.mjs` new test asserts `ok === true` / `undefined`
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- The code at `functions/lib/validate.ts:158-175` does not match the excerpt (drift)
- Changing the branch to a drop causes any other validation test to fail beyond the updated ones (suggests mis-edit)
- `validateAuditPayload` is not found or has been moved/renamed
- The test file already contains a dropped-future test with conflicting semantics

## Maintenance notes

- Future attribution changes (e.g., new time bounds) should follow the same principle: **never reject a submission on self-reported timing** — drop or null instead.
- Reviewer should check that the comment explains the soft-drop rationale and that `FIRST_SEEN_MAX_SKEW_MS` remains 5 min (intentional).
- If `D-01` (server-side email) lands, this validation still matters — it guards the email's attribution block.
