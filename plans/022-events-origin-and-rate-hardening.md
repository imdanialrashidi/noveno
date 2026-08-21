# Plan 022: Harden /api/events — reject no-Origin and tighten rate-limit story

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- functions/api/events.ts functions/lib/rate-limit.ts tests/audit-function.test.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none (parallel with 020, 021)
- **Category**: security / perf
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`/api/events` writes to the metered Analytics Engine dataset (`NOVENO_EVENTS`). Today a `curl` with no `Origin` header bypasses the cross-site guard, and the per-isolate in-memory limiter (`60/min/IP`) resets per Cloudflare isolate — distributed bots each get a fresh bucket. Event bodies are tiny, but an attacker can burn quota and pollute acquisition data. The fix is a 2-part tightening: require a same-origin proof for browser-like requests, and document + test the isolate-local trade-off (full global limiter needs KV/D1, out of scope).

## Current state

Relevant files:
- `functions/api/events.ts` — guard + rate limit + dataset write (181 LOC)
- `functions/lib/rate-limit.ts` — isolate-local sliding window
- `tests/audit-function.test.mjs` — events endpoint tests (bottom half of file)

Excerpt — `functions/api/events.ts:100-123`:

```ts
  // Cross-site guard: a foreign page can send no-cors beacons that look
  // like our own events. Browsers attach Origin to cross-site POSTs; a
  // non-null Origin whose host differs from the request Host is rejected.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  if (origin && !origin.startsWith("https://") && !origin.startsWith("http://")) {
    // opaque origin ("null") from sandboxed pages — reject
    return errorResponse("validation", 400);
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return errorResponse("validation", 400);
    } catch {
      return errorResponse("validation", 400);
    }
  }

  // Abuse gate for the metered Analytics Engine write path
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!limiter(ip)) {
    return errorResponse("rate_limited", 429);
  }
```

Excerpt — `functions/lib/rate-limit.ts` (entire module ~30 LOC): per-isolate `Map<string, number[]>` sliding window, `max: 60, windowMs: 60_000` for events at `functions/api/events.ts:179`:

```ts
const eventsLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });
```

Test excerpt — `tests/audit-function.test.mjs:430` (cross-site guard):

```ts
assert.equal((await postTo({ origin: "https://evil.example", host: "noveno.ir" })).status, 400);
assert.equal((await postTo({ origin: "https://noveno.ir", host: "noveno.ir" })).status, 204);
assert.equal((await postTo()).status, 204); // no Origin → same as today (THIS LINE CHANGES)
assert.equal((await postTo({ origin: "null", host: "noveno.ir" })).status, 400);
```

Repo conventions:
- `functions/api/events.ts` must never throw into callers; degraded `501` when binding missing is tested.
- Tests inject `RateLimiter` at `handleEventRequest` (`tests/audit-function.test.mjs:450` injected limiter pattern) — keep it for deterministic tests. Module-scope `eventsLimiter` is shared across tests in the process.
- Follow existing test order-independence pattern: use distinct `cf-connecting-ip` values for enum/pattern tests to avoid eating the shared bucket.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass (including new guard tests) |
| Targeted | `npm test -- --test-name-pattern="events endpoint"` | subset passes |
| Build | `npm run build` | 19 pages |

## Scope

**In scope** (only files you should modify):
- `functions/api/events.ts` — no-Origin policy + header documentation
- `functions/lib/rate-limit.ts` — add pruning comment / optional TTL (no new binding)
- `tests/audit-function.test.mjs` — update cross-site guard test + add no-Origin test

**Out of scope** (do NOT touch):
- `functions/api/audit.ts` (plan 021)
- `src/scripts/analytics.ts` — client beacon path unchanged (but must still work without Origin in same-origin fetch where browser *does* send Origin for POST — verify)
- Any new KV/D1 binding (that's `D-04` spike if ever)
- `public/_headers` (plan 024)

## Git workflow

- Branch: `advisor/022-events-origin-and-rate-hardening`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Tighten the no-Origin policy (reject non-browser probers, keep real beacons working)

The current guard allows requests with **no** `Origin` header (`assert.equal((await postTo()).status, 204)`). This is the `curl` bypass. Real browser beacons for `POST /api/events` from our own pages **do** send `Origin` (same-origin POST with `fetch` + `sendBeacon` both attach it in modern browsers), so we can tighten without breaking.

Change `functions/api/events.ts:100-118` to:

```ts
  // Origin guard (plan 022): browsers attach Origin to POST/beacon; curl
  // and other non-browser probers often omit it. Require either:
  //  - a valid same-host Origin, or
  //  - a same-host Referer when Origin is absent (covers older sendBeacon
  //    edge cases). Otherwise reject — the metered Analytics Engine path
  //    must not be writable by bare curl.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer") ?? request.headers.get("referrer") ?? "";
  const host = request.headers.get("host") ?? "";
  // opaque origin
  if (origin && !origin.startsWith("https://") && !origin.startsWith("http://")) {
    return errorResponse("validation", 400);
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return errorResponse("validation", 400);
    } catch {
      return errorResponse("validation", 400);
    }
  } else {
    // No Origin — require same-host Referer as fallback; bare curl has neither.
    if (!referer) return errorResponse("validation", 400);
    try {
      const refHost = new URL(referer).host;
      if (refHost !== host) return errorResponse("validation", 400);
    } catch {
      return errorResponse("validation", 400);
    }
  }
```

Key: real `src/scripts/analytics.ts: sendBeacon` and `fetch(..., keepalive:true)` both send `Origin` in Chrome/Firefox/Safari. The fallback `Referer` branch covers any edge case where `Origin` is suppressed (older WebView). Bare `curl` with neither header is now `400`.

**Verify**: `npm run check` → exit 0

### Step 2: Document and test the isolate-local limiter (no code change to algorithm)

`functions/lib/rate-limit.ts` stays `Map`-based, but add a doc note at the top:

```ts
// Isolate-local by design: each Cloudflare isolate keeps its own Map.
// Distributed floods (many IPs or many isolates) still get per-IP, per-isolate
// throttling; global throttling requires a durable binding (KV/D1) — see D-04.
```

No new binding is added. The 60/min/IP window at `functions/api/events.ts:179` stays.

**Verify**: `npm run check` → exit 0

### Step 3: Update tests to pin the new no-Origin behavior

In `tests/audit-function.test.mjs`, the cross-site guard test (around `:430`) must change:

```ts
// Before (old): assert.equal((await postTo()).status, 204); // no Origin → same as today
// After:
assert.equal((await postTo({ referer: "https://noveno.ir/audit" , host: "noveno.ir" })).status, 204); // no Origin but valid Referer → 204
assert.equal((await postTo()).status, 400); // no Origin and no Referer → 400 (curl)
assert.equal((await postTo({ origin: "null", host: "noveno.ir" })).status, 400);
```

Also add a new test `events endpoint: no-Origin without Referer is rejected (curl guard)` that exercises the bare `post({...})` with no headers and asserts `400` and `written.length === 0`.

Keep the `text/plain bodies (sendBeacon) still accepted` test — it must now also send a valid `Origin` or `Referer` to pass guard. Update its request to include `origin: "https://noveno.ir"`.

**Verify**: `npm test` → all pass (existing flood test `handleEventRequest` with injected limiter must still pass — it bypasses the guard because it sends a valid `cf-connecting-ip` but not Origin; update that test's request to include a valid Origin/Referer or make the flood test use `handleEventRequest` directly with no guard check? The flood test at `tests/audit-function.test.mjs:460` already uses `handleEventRequest` with injected limiter — it will need a valid Origin/Referer header to reach the limiter. Add `origin: "https://noveno.ir"` to its `post` helper.)

### Step 4: Verify client beacon still reaches the endpoint

No code change in `src/scripts/analytics.ts`, but verify manually (or via existing `tests/client-modules.test.mjs:120` beacon test) that `captureAttribution` + `track` + `initAnalytics` flow still issues a beacon that would pass the new guard. The client uses `navigator.sendBeacon(EVENT_URL, body)` where `EVENT_URL = "/api/events"` — browsers will attach `Origin: https://noveno.ir` for same-origin POST. No action besides confirming `client-modules.test.mjs` still passes.

**Verify**: `npm test` → `analytics: track queues and flushes via sendBeacon` still passes

## Test plan

- Update `tests/audit-function.test.mjs`:
  - `events endpoint: cross-site Origin is rejected, same-site passes (beacon guard)` — now also asserts `no Origin + no Referer → 400`, `no Origin + valid Referer → 204`
  - `events endpoint: no-Origin without Referer is rejected (curl guard)` — new test, 400 without write
  - Update `events endpoint: text/plain bodies (sendBeacon) still accepted` to include `origin` header
  - Update flood test to include `origin: "https://noveno.ir"` so it reaches the limiter (still `first429 === 60`)
- Keep `tests/client-modules.test.mjs` beacon tests green (they drive `initAnalytics` → `track` → `sendBeacon`, not directly `/api/events`)
- Verification: `npm test` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new assertion `no Origin + no Referer → 400` exists and passes
- [ ] `grep -n "referer\|referrer" functions/api/events.ts` returns hits (fallback branch)
- [ ] `grep -n "handleEventRequest" tests/audit-function.test.mjs` flood test still asserts `first429 === 60`
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- The guard change blocks real beacons (`tests/client-modules.test.mjs` beacon test fails with 400 after your change even when sending a valid Origin — suggests wrong header name or host comparison)
- `host` header is not available in the test harness (undici `Request` doesn't synthesize `host` — you may need to pass it explicitly in tests, as the existing cross-site test does)
- The isolate-local limiter needs a breaking change to satisfy quota — don't add a KV binding; document and stop
- Any non-event test starts failing (e.g., audit validation) — you edited the wrong file

## Maintenance notes

- The `Referer` fallback is intentional for older sendBeacon edge cases; if analytics clients move to `fetch` only, it can be removed. Reviewer should confirm no `Referer-Policy: no-referrer` is set that would strip it (current policy is `strict-origin-when-cross-origin` at `public/_headers` — preserves same-origin referer).
- Global rate limiting would require a durable binding (KV/D1) — evaluate in `D-04` (attribution aggregation spike) where a store is already considered.
- Keep the cross-site test's distinct `cf-connecting-ip` values (enum/pattern buckets) to avoid eating the module-scope `eventsLimiter` bucket shared across tests.
