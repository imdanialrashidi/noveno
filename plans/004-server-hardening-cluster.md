# Plan 004: Server hardening odds (honeypot shapes, API response headers, bounded limiter map)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- functions/lib/validate.ts functions/lib/respond.ts functions/lib/rate-limit.ts functions/api/events.ts tests/audit-function.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (each change is additive or strictly tighter; Turnstile remains the primary gate)
- **Depends on**: none (runs fine after 001–003; no ordering requirement)
- **Category**: security (defensive hardening)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Three small gaps in the only server boundary (`/api/audit`, `/api/events`), each cheap to close:

1. The honeypot trips only on a non-empty **string**. A bot submitting `"company_website": true`,
   an array, or an object passes the gate while a real user's empty string is correctly ignored.
   Defense-in-depth should treat *any present, meaningful value* as automation.
2. API responses set only `content-type`. `public/_headers` hardens static routes, but Pages
   Functions responses are not reliably covered by `_headers`; POST responses and error bodies
   should carry `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` at the source.
3. The per-isolate rate limiter's key map grows without bound: every distinct IP adds an entry
   that is never evicted, so an IP-rotating flood inflates isolate memory until recycle.

None of these is urgent alone — together they close the "small stuff" class on the trust boundary.

## Current state

### Honeypot: `functions/lib/validate.ts` (~lines 42–45)

```ts
export function honeypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim() !== "";
}
```

The legitimate client always sends a string (`src/scripts/audit/index.ts buildPayload()`:
`company_website: honeypot?.value ?? ""`), so tightening to "any defined value that isn't an empty
string" cannot reject real users.

### Response helper: `functions/lib/respond.ts` (whole file, 16 lines)

```ts
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(code: ErrorCode, status: number, fields?: Record<string, string>): Response {
  return jsonResponse({ ok: false, error: { code, ...(fields ? { fields } : {}) } }, status);
}
```

Both endpoints route ALL responses through these helpers — except one: `events.ts` returns a bare
`new Response(null, { status: 204 })` for its success path (~line 144). Cover that too.

### Rate limiter: `functions/lib/rate-limit.ts`

```ts
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

Per-key arrays are pruned on access, but keys themselves accumulate forever within the isolate's
lifetime. The header comment already documents isolate-local semantics as accepted ("Documented
limitation") — keep that framing; you are bounding memory, not adding distributed state.

Existing limiter behavior tests live in `tests/audit-function.test.mjs` (window sliding, max
enforcement). Both endpoints instantiate module-scope limiters:
`audit.ts`: `createRateLimiter({ max: 10, windowMs: 60_000 })`;
`events.ts`: max 60/min/IP.

### Repo conventions

- Functions code is dependency-free Workers TypeScript; comments explain rationale with plan
  references.
- Tests inject fake `now` where timing matters — check how existing limiter tests do it and reuse
  that seam (`now?: () => number` option exists precisely for this).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Function tests | `node --test tests/audit-function.test.mjs` | all pass |
| Events tests | `node --test tests/audit-function.test.mjs` (same file) | all pass |
| Full suite (after build) | `npm test` | all pass |
| Full gate | `bash scripts/verify.sh` | exit 0 |

Run `npm run build` before `npm test` (structural suites read `dist/`).

## Scope

**In scope**:
- `functions/lib/validate.ts` — honeypot shape handling
- `functions/lib/respond.ts` — response headers
- `functions/lib/rate-limit.ts` — map bounding
- `functions/api/events.ts` — 204 path headers only
- `tests/audit-function.test.mjs` (+ any dedicated rate-limit/honeypot test file if one exists — grep first)
- `plans/README.md` — status row

**Out of scope**:
- Durable/distributed rate limiting (KV/D1) — that is the recorded D‑04 direction, explicitly deferred.
- Any change to Turnstile verification, request ordering, or status codes/error codes.
- CSP or any static-route header in `public/_headers`.
- Origin/referer guard logic in `events.ts` (its best-effort nature is documented).

## Git workflow

- Branch: `improve/004-server-hardening`
- Conventional commits, e.g.:
  - `fix(security): honeypot triggers on any meaningful value shape`
  - `fix(security): no-store + nosniff on API responses`
  - `chore(security): bound rate-limiter key memory`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Honeypot triggers on any meaningful value

Replace the body of `honeypotTriggered`:

```ts
export function honeypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  if (value === undefined || value === null) return false;
  // Legit clients submit an empty hidden input → "". Anything else present
  // (non-empty string, number, array, object) marks automation.
  if (typeof value === "string") return value.trim() !== "";
  return true;
}
```

Update the function's doc comment to state the shape rule.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass.

### Step 2: Pin the new honeypot semantics

Add tests next to the existing honeypot cases:

- `""` and `"   "` → NOT triggered;
- absent field → NOT triggered;
- `true`, `42`, `["x"]`, `{}` → triggered;
- `"spam"` → triggered.

**Verify**: same command as Step 1 → all pass.

### Step 3: Security headers on every API response

In `functions/lib/respond.ts`, extend `jsonResponse`:

```ts
const RESPONSE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  // API responses are never cacheable and must never be MIME-sniffed.
  // (_headers does not reliably cover Pages Function responses.)
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...RESPONSE_HEADERS } });
}
```

In `functions/api/events.ts`, give the bare 204 the same headers:

```ts
return new Response(null, { status: 204, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
```

(Or export the header constant from `respond.ts` and spread it — prefer the shared constant.)

Then run the function suite: some tests may assert exact header objects or snapshot responses;
update them additively (asserting the new headers exist), never by deleting assertions.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass.

### Step 4: Assert the headers in tests

Add one focused test (or extend the response-contract test):

```ts
const res = await handleAuditRequest(post(invalidPayload()), deps); // any path
assert.equal(res.headers.get("cache-control"), "no-store");
assert.equal(res.headers.get("x-content-type-options"), "nosniff");
```

and one for the events 204 path if the events tests construct requests directly.

**Verify**: same command → all pass.

### Step 5: Bound the limiter map

Modify `createRateLimiter` to opportunistically evict dead keys:

```ts
export function createRateLimiter({ max, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();
  /** Memory bound: sweep when tracked keys exceed this many. */
  const MAX_TRACKED_KEYS = 10_000;

  return (key: string): boolean => {
    const t = now();
    const windowStart = t - windowMs;

    // Opportunistic sweep: keeps the map bounded under IP-rotation floods.
    if (hits.size > MAX_TRACKED_KEYS) {
      for (const [k, stamps] of hits) {
        const newest = stamps[stamps.length - 1] ?? 0;
        if (newest <= windowStart) hits.delete(k);
      }
    }

    const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
    ...existing logic unchanged...
```

Rationale comment: sweep threshold amortizes the O(n) walk; under normal traffic (< threshold)
behavior is byte-for-byte identical to today. Keep the existing "isolate-local by design" header
comment and append one line: "Keys are swept once tracked-key count exceeds the bound."

**Verify**: `node --test tests/audit-function.test.mjs` → all pass.

### Step 6: Test the bound deterministically

Using the injected `now` seam (existing limiter tests show the pattern):

```ts
test("limiter sweeps expired keys beyond the tracking bound", () => {
  let t = 0;
  const rl = createRateLimiter({ max: 1, windowMs: 1_000, now: () => t });
  for (let i = 0; i < 10_001; i++) rl(`ip-${i}`);          // exceed the bound
  assert.ok(/* map size observable? */ true);              // see note below
});
```

The Map is closed over. To make the bound testable WITHOUT exporting internals, either:
(a) have `createRateLimiter` accept an optional `onSweep?: (size: number) => void` debug hook used
only by tests, or (b) expose `hits.size` via a returned property (`rl.size` getter) alongside the
call signature. Choose (b) — smallest surface:

```ts
const limit = (key: string): boolean => { ...existing... };
return Object.assign(limit, { get size() { return hits.size; } });
```

Then assert after the loop that `rl.size <= 10_000 + 1` (the current key) and that sweeping old
windows frees keys: advance `t` past the window, call once more, assert `size` shrank to ~1.
Callers are unaffected (the return value is still `(key) => boolean` plus a getter).

Update the type: `export type RateLimiter = ((key: string) => boolean) & { readonly size: number };`

**Verify**: `node --test tests/audit-function.test.mjs` → all pass, including the new bound tests.

## Test plan

All in the existing function-test file following its patterns (fake `Request`s, injected deps,
injected clock):

- Honeypot: 7 shape cases (Step 2).
- Headers: audit error path + events 204 (Step 4).
- Limiter: flood-bounded size + post-window shrink (Step 6), reusing the injected-clock style of
  the existing sliding-window tests.

Red-first: Steps 2/4/6 tests fail against current code; apply fixes; watch green.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `node --test tests/audit-function.test.mjs` all pass (incl. ≥14 new assertions across the three areas)
- [ ] `grep -n "no-store" functions/lib/respond.ts` → matches
- [ ] `npm run build` exits 0; `npm test` passes; `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list modified; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Excerpts don't match live code.
- A test asserts an exact `Headers` object/serialization that cannot be updated additively.
- Adding the `size` getter breaks the `RateLimiter` type contract at a call site the compiler
  flags beyond the two endpoint files (unexpected consumer exists).
- The events 204 path has callers relying on a body-less header-free response in ways the tests
  encode rigidly.

## Maintenance notes

- The limiter stays per-isolate by design; the bound addresses memory, not bypass realism. When
  D‑04 (durable limiting/aggregation) is revisited, this file is the first candidate for
  replacement — keep it dependency-free until then.
- If Cloudflare later applies `_headers` to function routes, keeping the source-level headers is
  still correct (defense at the origin of the response).
- Reviewers should confirm: no error-code/status changes, honeypot cannot trigger on absent
  fields, and the sweep preserves exact admission decisions for keys inside their window.
