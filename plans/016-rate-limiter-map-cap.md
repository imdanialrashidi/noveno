# Plan 016: Cap the rate limiter's key map

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- functions/lib/rate-limit.ts tests/audit-function.test.mjs`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The in-memory sliding-window limiter (`functions/lib/rate-limit.ts`) keeps a
`Map<key, number[]>` per isolate and never evicts keys — only the per-key
timestamp arrays are pruned on access. Under many distinct IPs (NAT pools,
IPv6 scanning, DDoS spray) a long-lived isolate accumulates one entry per
unique key with no upper bound. Cloudflare's isolate recycling bounds the
blast radius today (documented limitation in the module header), but the
leak is real and the fix is one eviction rule. Both limiters (audit
`max: 10`, events `max: 60`) share the module.

## Current state

`functions/lib/rate-limit.ts` (full, 34 lines):

```ts
export interface RateLimiterOptions {
  /** Max allowed requests inside the window per key. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  now?: () => number;
}

export type RateLimiter = (key: string) => boolean;

export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return (key: string): boolean => {
    const t = now();
    const windowStart = t - windowMs;
    const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
}
```

The existing unit tests (`tests/audit-function.test.mjs` ~lines 350-370)
use `createRateLimiter({ max: 3, windowMs: 1000, now: () => t })`.

## Repo conventions to match

- Options objects with optional overrides (`now`) are the established
  pattern — add `maxKeys` the same way, with a documented default.
- The module header comment documents the per-isolate limitation; keep it
  honest (this fix bounds the map; the per-isolate nature stays).
- Map preserves insertion order — `hits.keys().next().value` yields the
  oldest inserted key, which is the correct eviction target.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `functions/lib/rate-limit.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `functions/api/audit.ts` / `functions/api/events.ts` — the two limiter
  instances are fine as constructed; the default cap applies transparently.
- Changing the limiter's window semantics (sliding window stays).

## Git workflow

- Branch: `improve/016-rate-limiter-cap`
- Commit message style (match the repo): `fix(functions): cap the rate limiter key map per isolate`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the key cap

In `functions/lib/rate-limit.ts`:

1. Extend the options:
   ```ts
   export interface RateLimiterOptions {
     /** Max allowed requests inside the window per key. */
     max: number;
     /** Window length in ms. */
     windowMs: number;
     /** Cap on distinct keys kept per isolate (default 10_000) — evicts
      *  the oldest key, bounding memory under IP spray. */
     maxKeys?: number;
     now?: () => number;
   }
   ```
2. In `createRateLimiter`, capture `const keyCap = maxKeys ?? 10_000;` and
   factor the two `hits.set(key, recent)` calls into one helper that evicts
   first:
   ```ts
   const record = (key: string, recent: number[]): void => {
     if (!hits.has(key) && hits.size >= keyCap) {
       const oldest = hits.keys().next().value;
       if (oldest !== undefined) hits.delete(oldest);
     }
     hits.set(key, recent);
   };
   ```
   and replace both `hits.set(key, recent)` calls with `record(key, recent)`.
3. Update the module header comment: add one line noting the key-map cap.

**Verify**: `npm run check` exits 0; `node --test tests/audit-function.test.mjs` → all existing tests pass unchanged (default cap is transparent at these sizes).

### Step 2: Add tests

In `tests/audit-function.test.mjs`, in the rate-limiter section:

```js
test("rate limiter caps the distinct-key map (evicts oldest)", () => {
  let t = 0;
  const limit = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 3, now: () => t });
  assert.equal(limit("a"), true);
  assert.equal(limit("b"), true);
  assert.equal(limit("c"), true);          // 3 keys — at cap
  assert.equal(limit("d"), true);          // evicts "a" (oldest), d allowed
  assert.equal(limit("a"), true,          // "a" evicted — fresh window
    "the oldest key must be fully evicted, not merely pruned");
  assert.equal(limit("b"), false,          // "b" still tracked — already 2 hits
    "recent keys must keep their windows");
  // cap must not break the rate gate: c now has 2 hits → third call blocks
  assert.equal(limit("c"), true);
  assert.equal(limit("c"), false);
});
```

Adjust the exact expectations to the implementation you wrote (the invariant
is: size never exceeds `maxKeys`; the evicted key's window resets; other
keys are unaffected).

**Verify**: `node --test tests/audit-function.test.mjs` → all pass. Red-before-green: on the pre-change limiter the eviction assertions fail (no cap exists — `hits.size` grows past 3 and `a` keeps its window).

## Test plan

- 1 new test in the rate-limiter section of `tests/audit-function.test.mjs`.
- Pattern: the existing `createRateLimiter({ max: 3, windowMs: 1000, now: () => t })` test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-function.test.mjs` exits 0 with the new eviction test
- [ ] `npm run check` exits 0; `npm run build` exits 0
- [ ] `grep -n "maxKeys" functions/lib/rate-limit.ts` → options + `?? 10_000` present
- [ ] `grep -c "hits.set(key, recent)" functions/lib/rate-limit.ts` → 0 (all call sites route through `record`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The module's structure differs from the excerpts (drift) — reconcile.
- The eviction choice turns out to interact badly with the events flood
  test (the 80-request flood test shares the module-scope limiter): if the
  new test order makes it flaky, reorder tests in the file — if it still
  fails, STOP and report.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The cap is per-isolate; a global bound still doesn't exist (and cannot,
  without external state) — Turnstile remains the primary abuse gate, as
  documented in the module header and `docs/ops/runbook.md`. Do not present
  this fix as "rate limiting is now global".
- If `maxKeys` is ever tuned, remember both limiter instances share the
  default; per-instance overrides are possible via the option.
- Plan 008's `buildAuditDeps` keeps the module-scope limiter — the cap
  applies automatically there.
