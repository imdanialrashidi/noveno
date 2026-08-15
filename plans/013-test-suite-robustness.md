# Plan 013: Make the suite deterministic (network-gated tests + injected events limiter)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- functions/api/events.ts tests/audit-function.test.mjs`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/010-events-endpoint-hardening.md (already applied — `functions/api/events.ts` and its tests changed; this plan builds on that shape)
- **Category**: tests
- **Planned at**: commit `13ef792`

## Why this matters

Two environment- and order-dependent behaviors make the suite's pass result
a function of the machine it runs on:

1. Three tests POST to the real `challenges.cloudflare.com` siteverify
   endpoint and silently `t.skip` on any network error — the result set
   differs per environment (3 skips vs 3 passes, up to 24s of wall time),
   and a sandboxed CI "passes" without exercising anything.
2. The events flood test relies on the module-scope `eventsLimiter`
   (60/min) shared across all tests in the process and asserts
   `first429 >= 50` — an absolute floor that breaks if earlier tests
   consume more than 10 slots, and a relative assertion that hides the
   exact behavior being tested.

Fix: gate the network tests behind an explicit env flag (deterministic
skip), and give the events handler an injected limiter so the flood test is
exact and order-independent.

## Current state

- `tests/audit-function.test.mjs:431-472` — three tests:
  ```js
  test("real Turnstile endpoint: official always-pass secret verifies", async (t) => {
    try {
      const data = await realSiteverify(SECRETS.alwaysPass, "any-token");
      assert.equal(data.success, true);
    } catch (err) {
      t.skip(`no route to challenges.cloudflare.com in this environment: ${err.message}`);
    }
  });
  ```
  (and always-fail + duplicate variants; `realSiteverify` at ~line 423-431 uses `AbortSignal.timeout(8000)`).
- `functions/api/events.ts` — module-scope `const eventsLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });` used inside `onRequest`; `handleEventRequest`-style deps injection does NOT exist yet (the audit boundary has the pattern: `handleAuditRequest(request, deps)` in `functions/api/audit.ts`).
- `tests/audit-function.test.mjs:790-810` — the flood test calls `eventsOnRequest(...)` (check the actual import name used in the file — read the events test section first) 80 times and asserts `first429 >= 50`.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Boundary tests | `node --test tests/audit-function.test.mjs` | all pass (network tests skipped with message) |
| With network | `RUN_NETWORK_TESTS=1 node --test tests/audit-function.test.mjs` | network tests run and pass (requires internet) |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `tests/audit-function.test.mjs`
- `functions/api/events.ts`

**Out of scope** (do NOT touch):
- `functions/api/audit.ts` (its deps-injection pattern is the model, not a target)
- `functions/lib/rate-limit.ts`, `functions/lib/respond.ts`
- Any other file.

## Git workflow

- Commit once at the end:
  `test: gate network tests behind RUN_NETWORK_TESTS and inject the events limiter`
- Do NOT push or open a PR.

## Steps

### Step 1: Gate the real-siteverify tests

In `tests/audit-function.test.mjs`, add near the top of the real-siteverify
section:

```js
// Network-gated: these hit the real Cloudflare endpoint. Run with
// RUN_NETWORK_TESTS=1 to exercise them; otherwise they skip so the
// suite's result is identical in sandboxed and networked environments.
const NETWORK_TESTS_ENABLED = process.env.RUN_NETWORK_TESTS === "1";
```

Then change each of the three tests to:

```js
test("real Turnstile endpoint: official always-pass secret verifies", async (t) => {
  if (!NETWORK_TESTS_ENABLED) {
    t.skip("network-gated: set RUN_NETWORK_TESTS=1 to run");
    return;
  }
  const data = await realSiteverify(SECRETS.alwaysPass, "any-token");
  assert.equal(data.success, true);
});
```

(Do the same for the always-fail and duplicate tests; remove their
try/catch + t.skip-on-error so a failure under the flag is a hard failure,
which is the point of the flag.)

**Verify**: `node --test tests/audit-function.test.mjs` → all pass with 3
explicit skips; `RUN_NETWORK_TESTS=1 node --test tests/audit-function.test.mjs` → the 3 network tests run (pass when the network allows; a hard failure reports the network issue rather than silently skipping).

### Step 2: Inject the events limiter

In `functions/api/events.ts`, refactor to mirror the audit boundary's
pattern. Extract the request handling from `onRequest` into:

```ts
export function handleEventRequest(
  request: Request,
  deps: { env: AuditEnv; limiter: RateLimiter },
): Promise<Response> { ... }
```

where `limiter` replaces the `eventsLimiter(...)` call inside, and
`onRequest` becomes:

```ts
const eventsLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });
export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> =>
  handleEventRequest(context.request, { env: context.env, limiter: eventsLimiter });
```

Import `RateLimiter` type from `../lib/rate-limit.ts`. Check how
`tests/audit-function.test.mjs` currently imports the events handler
(grep `eventsOnRequest` or the import line) and keep a compatible export
name if the tests use it — update the test imports to the new name if you
rename, and note it.

**Verify**: `node --test tests/audit-function.test.mjs` — the existing
events tests pass with the refactor (update their import if needed).

### Step 3: Make the flood test exact

In `tests/audit-function.test.mjs`, change the flood test to build its own
limiter and pass it via deps:

```js
test("events endpoint: floods are rate-limited before any write (MAJOR-2)", async () => {
  const written = [];
  const limiter = createRateLimiter({ max: 60, windowMs: 60_000 });
  const request = () =>
    handleEventRequest(post({ name: "audit_started", payload: { page: "/audit" } }), {
      env: { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } },
      limiter,
    });
  const statuses = [];
  for (let i = 0; i < 80; i += 1) statuses.push((await request()).status);
  const first429 = statuses.indexOf(429);
  assert.equal(first429, 60, "throttling must begin exactly at the limiter max");
  assert.ok(statuses.slice(first429).every((s) => s === 429));
  assert.equal(written.length, 60, "no writes may happen after throttling begins");
});
```

Import `createRateLimiter` from `../functions/lib/rate-limit.ts` (the file
may already import it — check). Remove the "shared module-scope limiter"
comment that explained the relative assertions.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass;
run the flood test 3× consecutively → identical results each time.

## Test plan

- Step 1: deterministic skip path for network tests.
- Step 3: exact flood assertions with injected limiter.

## Done criteria

- [ ] `grep -n "RUN_NETWORK_TESTS" tests/audit-function.test.mjs` → present
- [ ] `grep -n "limiter" functions/api/events.ts` → the injected-dep shape present
- [ ] `node --test tests/audit-function.test.mjs` passes (3 skips, no network)
- [ ] `npm test` and `npm run build` pass
- [ ] Flood test deterministic: 3 consecutive runs identical
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- The events tests import the handler under a different name than expected
  (grep first; adapt the import, note it).
- Plan 010 changed `validateEvent`'s signature in a way that conflicts with
  the flood test's payload (read the current test before editing).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `RUN_NETWORK_TESTS=1` is the explicit opt-in for the real siteverify
  checks; CI does not set it (documented deterministic skip).
- If the events limiter window or max ever changes, the flood test asserts
  `first429 === max` — update both together.
- Reviewer should scrutinize: no `t.skip` remains inside try/catch (a
  network failure under the flag must fail loudly), and the flood test's
  exact `60` constant is derived from the limiter config, not magic.
