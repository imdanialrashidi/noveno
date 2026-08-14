# Plan 002: Reject cross-origin posts to /api/events (same-origin gate)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- functions/api/events.ts tests/audit-function.test.mjs`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

`/api/events` is a metered Analytics Engine write path, and its only abuse
gate today is a per-IP rate limiter (`functions/api/events.ts:119`). The
client delivers events via `navigator.sendBeacon` (`src/scripts/analytics.ts:95-114`),
which is a no-cors request: no preflight, no CORS. Any third-party page can
therefore fire beacons at `https://noveno.ir/api/events` from its visitors'
browsers — the `cf-connecting-ip` seen by the function is the *victim's* IP,
so the per-IP limiter does not bind the attacker. Impact: the Analytics
Engine free-tier write quota can be burned and the acquisition-funnel dataset
polluted (skewing the funnel numbers the founder will make decisions from).
The fix is a standard same-origin check on the `Origin` header; legit
same-origin beacons always carry the site's own origin.

## Current state

`functions/api/events.ts` `onRequest` (lines ~51-119), in order:
1. `request.method !== "POST"` → 405;
2. `eventsLimiter(ip)` → 429 (module-scope limiter, `max: 60, windowMs: 60_000`);
3. declared content-length > `LIMITS.maxEventsBodyBytes` → 413;
4. parse body, `validateEvent`, 400 on invalid;
5. write one Analytics Engine datapoint (`indexes: [event.name]`, `doubles: [Date.now()]`, `blobs: [page, section, JSON.stringify(event.payload)]`) → 204, or 501 when the binding is absent.

There is no `Origin`/`Referer`/host check anywhere in the handler.

`tests/audit-function.test.mjs` events section (lines ~730-810): tests
`validateEvent`, 405/413, 501-without-binding, 204-with-write,
400-without-write, and the flood/rate-limit test. The `post()` helper builds
POST requests; the GET test constructs `new Request(...)` directly.

## Repo conventions to match

- Error responses use `errorResponse(code, status)` from
  `functions/lib/respond.ts`; success uses `jsonResponse` or a bare
  `new Response(null, { status: 204 })` (see the existing 204 at the end of
  `onRequest`).
- The events endpoint is deliberately PII-free and fire-and-forget from the
  client's perspective; keep the 501-degrade behavior untouched.
- The per-IP limiter stays as a second layer — do not remove it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs` | all tests pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file functions/api/events.ts` | routes to the functions lane |

## Scope

**In scope** (the only files you should modify):
- `functions/api/events.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch, even though they look related):
- `src/scripts/analytics.ts` — the client's delivery mechanism is correct;
  no client change is needed for this gate.
- The audit submission endpoint (`functions/api/audit.ts`) — it has its own
  abuse posture (Turnstile); this plan is events-only.
- Adding UTM keys to events (plan 013) — different change, same file; keep
  this diff to the origin gate only.

## Git workflow

- Branch: `improve/002-events-origin-gate`
- Commit message style (match the repo): `fix(events): reject cross-origin posts with a same-origin gate`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the origin check

In `functions/api/events.ts` `onRequest`, immediately after the method check
(before the rate limiter — rejected requests must not consume limiter slots),
insert:

```ts
// Same-origin gate (audit finding SEC-01): sendBeacon is no-cors, so a
// third-party page can fire beacons from a victim's browser and the
// per-IP limiter would see the victim's IP. Browsers send Origin on all
// POSTs; accept only the site's own origin ("null" — sandboxed/private
// contexts — and absent Origin stay allowed; the limiter still binds them).
const origin = request.headers.get("origin");
if (origin && origin !== "null") {
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).origin === new URL(request.url).origin;
  } catch {
    sameOrigin = false; // unparsable Origin → reject
  }
  if (!sameOrigin) {
    return errorResponse("validation", 400);
  }
}
```

Notes:
- `request.url` in a Pages Function is the full request URL, so
  `new URL(request.url).origin` is the site origin (e.g. `https://noveno.ir`).
- Keep the module-top comment accurate: mention the origin gate in the
  endpoint's doc comment.

**Verify**: `node --test tests/audit-function.test.mjs` → all existing tests pass (the change is additive and existing tests send no Origin header, which stays allowed).

### Step 2: Add defect-sensitive tests

In `tests/audit-function.test.mjs`, in the events section, add a test that
proves the gate both ways:

```js
test("events endpoint: cross-origin posts are rejected before any write", async () => {
  const written = [];
  const env = { NOVENO_EVENTS: { writeDataPoint: (d) => written.push(d) } };
  const postTo = (origin, payload) =>
    eventsOnRequest({
      request: new Request("https://noveno.ir/api/events", {
        method: "POST",
        headers: origin ? { origin } : {},
        body: JSON.stringify(payload),
      }),
      env,
    });

  const good = await postTo("https://noveno.ir", { name: "audit_started", payload: { page: "/audit" } });
  assert.equal(good.status, 204, "same-origin post must be accepted");
  assert.equal(written.length, 1, "same-origin post must write");

  const evil = await postTo("https://evil.example", { name: "audit_started", payload: { page: "/audit" } });
  assert.equal(evil.status, 400, "cross-origin post must be rejected");
  assert.equal(written.length, 1, "no write may happen for a cross-origin post");

  const spoofed = await postTo("https://noveno.ir.evil.example", { name: "audit_started" });
  assert.equal(spoofed.status, 400, "origin-suffix spoofing must be rejected");

  const nullOrigin = await postTo("null", { name: "audit_started" });
  assert.equal(nullOrigin.status, 204, "null origin (sandboxed contexts) stays allowed");
});
```

Also add a `trailing-slash`/case check if you like (`https://noveno.ir/` is
normalized by `new URL(...).origin` to `https://noveno.ir` — assert the
same-origin case with a trailing slash passes).

**Verify**: `node --test tests/audit-function.test.mjs` → all pass, including the new test. For a red-before-green record: run the new test on the pre-change `events.ts` first (revert step 1 temporarily or stash it) — the cross-origin case must 204 on the old code and 400 after the change.

## Test plan

- One new test in the events section of `tests/audit-function.test.mjs`
  covering: same-origin accepted + written; cross-origin rejected + no
  write; suffix-spoofed origin rejected; `null` origin allowed; (optional)
  trailing-slash normalization.
- Pattern: follow the existing "events endpoint: writes a data point when
  the binding exists" test — same `written` recorder and `env` shape.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-function.test.mjs` exits 0 with the new test present and passing
- [ ] `npm run check` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "origin" functions/api/events.ts` shows the gate; no `Origin` validation anywhere else added
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- You discover the assumption "browsers send an Origin header on same-origin
  sendBeacon POSTs" is false in a way that breaks legit traffic (evidence:
  a browser test showing same-origin beacons carry no Origin) — then the
  gate must allow absent Origin (it already does) and the plan is still valid.

## Maintenance notes

- Plan 013 (UTM funnel events) also touches the events path — land it after
  this plan so the origin gate is already covered by tests when payload keys
  change.
- If the site ever uses a CDN/custom domain set that differs from the
  canonical origin, revisit `new URL(request.url).origin` — the check
  compares against the actual request host, so it stays correct.
- A stricter variant (requiring Origin on every POST, rejecting absent) is
  possible but would break non-browser clients; not recommended for a
  marketing-site analytics path. Documented here so it isn't re-litigated.
