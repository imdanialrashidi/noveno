# Plan 001: Key Turnstile siteverify idempotency by token, not by submission

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- functions/`
> Then compare the "Current state" excerpts against the live code. On a
> mismatch, treat it as a STOP condition and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `13ef792`

## Why this matters

The audit form is the site's only conversion. When submission fails after a
network blip, the client retries with a **fresh Turnstile token** but the
**same `submission_id`**. The server currently passes `submission_id` as the
Turnstile `idempotency_key` for every verification. Turnstile's
`idempotency_key` is documented to return the cached result of the first
verification for that key — so a first verification that failed (e.g. the
token expired under Iranian network conditions, the exact scenario the retry
banner exists for) would be cached, and every retry with a fresh token would
get the cached **failure**, permanently locking the user out of the primary
conversion. Conversely, one genuine pass could be replayed with arbitrary
tokens. The fix keys the idempotency by the token itself: the same token
re-verified after a network blip (the documented purpose) hits the same key,
while each fresh token gets a fresh key.

## Current state

- `functions/lib/turnstile.ts:10-16` — docstring claims the key exists so
  "re-verifying the same token after a network blip is safe", and
  `verifyTurnstile()` (lines 30-63) sends `idempotency_key: idempotencyKey`
  in the siteverify body.
- `functions/api/audit.ts:127-138` — `onRequest` wires:
  ```ts
  verifyTurnstile: (submission, ip) =>
    verifyTurnstile({
      secret: env.TURNSTILE_SECRET_KEY,
      token: submission.cf_turnstile_token,
      remoteIp: ip,
      idempotencyKey: submission.submission_id,   // ← the bug
    }),
  ```
- `src/scripts/audit.ts` (`retry()` at ~line 228, `invalidate()` ~line 222)
  deliberately mints a fresh token per attempt with the same
  `submission_id` — pinned by `tests/audit-retry.test.mjs`
  ("a consumed/invalid Turnstile token must never be reused").

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Unit tests | `node --test tests/audit-function.test.mjs` | all pass |
| Client tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

If `npm ci` fails with a package.json/lockfile mismatch, use `npm install`
instead (another plan updates the lockfile later; never edit the lockfile
by hand).

## Scope

**In scope**:
- `functions/lib/turnstile.ts`
- `functions/api/audit.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `src/scripts/audit.ts` — client behavior already correct (fresh token per retry).
- `functions/lib/persist.ts`, `functions/lib/contract.ts`, the Supabase migration.
- Any other file.

## Git workflow

- Worktree branch provided by the reviewer. Commit once at the end:
  `fix(security): key Turnstile siteverify idempotency by token per attempt`
- Do NOT push or open a PR.

## Steps

### Step 1: Add a token-derived idempotency-key helper

In `functions/lib/turnstile.ts`, add:

```ts
/**
 * Deterministic idempotency key for a siteverify attempt: the SHA-256 of
 * the token itself. Re-verifying the SAME token (network blip) reuses the
 * key — Cloudflare returns the first verification's result, which is what
 * we want for the same token. A fresh client token (retry path) gets a
 * fresh key, so a failed first attempt can never lock the retry out.
 */
export async function idempotencyKeyForToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

Also update the module docstring (lines 4-9): the key is now derived from the
token, and the retry path (fresh token → fresh key) must be mentioned.

**Verify**: `node --test tests/audit-function.test.mjs` still passes (no
behavior change yet — helper unused).

### Step 2: Use the helper at the boundary

In `functions/api/audit.ts`, change the `onRequest` wiring so the
idempotency key derives from the token:

```ts
verifyTurnstile: async (submission, ip) =>
  verifyTurnstile({
    secret: env.TURNSTILE_SECRET_KEY,
    token: submission.cf_turnstile_token,
    remoteIp: ip,
    idempotencyKey: await idempotencyKeyForToken(submission.cf_turnstile_token),
  }),
```

Update the `import` of turnstile.ts to include `idempotencyKeyForToken`.
`handleAuditRequest` itself must NOT change (its `AuditDeps.verifyTurnstile`
signature stays `(submission, ip)` — this is what keeps the existing
dependency-injected tests valid).

**Verify**: `node --test tests/audit-function.test.mjs` passes.

### Step 3: Regression tests

In `tests/audit-function.test.mjs`, add tests:

1. **Helper determinism**: `idempotencyKeyForToken("tok-A")` equals
   `idempotencyKeyForToken("tok-A")`, differs from
   `idempotencyKeyForToken("tok-B")`, and is a 64-char hex string.
2. **Boundary wiring**: build the real verifier via a small exported seam —
   if `onRequest` is not directly testable, assert through the helper +
   a `fetchImpl` spy that captures the siteverify body: call
   `verifyTurnstile({ secret, token: "tok-1", remoteIp: null, idempotencyKey: await idempotencyKeyForToken("tok-1"), fetchImpl })`
   and assert the sent `idempotency_key` equals the token's hash; repeat
   with `tok-2` and assert it differs.
3. **Failed-then-succeeded sequence under one submission_id**: simulate the
   retry journey at the boundary level — `handleAuditRequest` with a
   scripted `verifyTurnstile` that records the tokens it saw and fails the
   first call, plus a persistLead stub; assert the second request (new
   token) is able to reach persistence (i.e., the harness never blocks on a
   cached failure — the fresh-token call is what the server issues).

Follow the existing test style in that file (plain `test()` + `assert`).

**Verify**: `node --test tests/audit-function.test.mjs` → all pass including
the new tests (count them in your report).

## Test plan

- New tests listed in Step 3, in `tests/audit-function.test.mjs`.
- Pattern to follow: the existing `test("turnstile ...")` tests around
  lines 400-475, which use `fetchImpl` spies and `assert.deepEqual` on
  outcomes.

## Done criteria

- [ ] `idempotencyKeyForToken` exported from `functions/lib/turnstile.ts` and used in `functions/api/audit.ts` `onRequest`
- [ ] `grep -n "idempotencyKey: submission.submission_id" functions/` → no matches
- [ ] `node --test tests/audit-function.test.mjs` passes with the new tests
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No files outside the in-scope list modified (`git status --porcelain`)

## STOP conditions

Stop and report back (do not improvise) if:

- `handleAuditRequest`'s `AuditDeps` interface or `verifyTurnstile` signature
  differs from the excerpts above.
- `crypto.subtle` is unavailable in the test environment (it should be —
  Node ≥ 19 exposes WebCrypto globally).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If Cloudflare ever documents different `idempotency_key` caching semantics,
  re-check this decision; the sha256-of-token scheme is safe under both
  "cached per key" and "no caching" interpretations.
- The client's `retry()`/`invalidate()` contract (fresh token per attempt)
  is what makes this fix correct — keep the audit-retry tests green.
- Reviewer should scrutinize: the helper lives in turnstile.ts (not audit.ts)
  so the seam is unit-testable.
