# Plan 004: Tie the Turnstile siteverify idempotency key to the token, not the submission

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- functions/api/audit.ts functions/lib/turnstile.ts functions/lib/contract.ts functions/lib/validate.ts src/scripts/audit.ts tests/audit-retry.test.mjs tests/audit-function.test.mjs`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — this is the recently-fixed retry path; the change must
  preserve "fresh token per retry" behavior and keep the payload contract
  backward compatible (new field optional).
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The server passes `idempotency_key = submission_id` to Turnstile siteverify
(`functions/api/audit.ts:137`). The client mints `submission_id` once at
journey start and keeps it stable across retries, while the retry path
obtains a **fresh** Turnstile token with the **same** `submission_id`
(verified by `tests/audit-retry.test.mjs` — the retry test pins fresh token
+ stable submission_id). Cloudflare's documented pattern is the opposite:
generate a UUID **per token** and reuse it only across retries of *that same
token* (developers.cloudflare.com/turnstile — "Idempotency keys for retry
operation"). Using a key that outlives its token means siteverify caching
semantics (per-key) can either replay a cached success for a replayed
submission_id (bounded harm — the Supabase upsert is idempotent on
`submission_id`) or, worse, cache a *failure* and permanently dead-end a
legitimate retry that presents a fresh token. The exact cross-token behavior
of the live endpoint is not documented and needs one live observation (Step
1); the fix (per-token key) matches the documented pattern regardless of
what that observation shows.

## Current state

- `functions/api/audit.ts:123-137` — `onRequest` wires
  `verifyTurnstile({ secret, token: submission.cf_turnstile_token, remoteIp: ip, idempotencyKey: submission.submission_id })`.
- `functions/lib/turnstile.ts:25-52` — `VerifyTurnstileParams.idempotencyKey: string`;
  the siteverify body includes `idempotency_key` unconditionally.
- `functions/lib/contract.ts` — `AuditSubmission` interface (lines ~136-161)
  with `cf_turnstile_token: string`; `UUID_PATTERN` exported at ~line 115.
- `functions/lib/validate.ts` — validates `cf_turnstile_token` (required,
  non-empty, ~line 130); no other turnstile field.
- `src/scripts/audit.ts`:
  - `createDraft()` (~124-131): `submission_id: crypto.randomUUID()` — stable across retries (by design; keep).
  - `TurnstileBridge` (class ~150-260): `onToken(value)` stores the token;
    `invalidate()` clears it; `retry()` clears it and unlatches script failure;
    `syncTheme()` removes the widget and clears the token. A fresh token is
    emitted via the widget `callback` after `reset()`.
  - `buildPayload(token)` (~541): includes `cf_turnstile_token: token`.
- `tests/audit-retry.test.mjs` — the retry test asserts
  `assert.deepEqual({ ...env.auditCalls[1], cf_turnstile_token: undefined },
  { ...env.auditCalls[0], cf_turnstile_token: undefined }, "all field values
  must remain intact across retry")` — this assertion will need the new key
  excluded too.
- `tests/audit-function.test.mjs` — `validPayload()` fixture; verifyTurnstile
  unit tests pass `idempotencyKey: "k"`; request-level tests inject
  `verifyTurnstile` directly (so they are unaffected by the wiring change).

## Repo conventions to match

- Payload fields are validated server-side with whitelist semantics
  (`validate.ts`); new fields must be added to `AuditSubmission` +
  validation, and the client↔server drift guard (plan 017) covers key sets.
- Keep the new field OPTIONAL so older clients and the existing fixture
  keep working; the server defaults to no idempotency key when absent
  (siteverify without the key is valid).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-retry.test.mjs` and `node --test tests/audit-function.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/scripts/audit.ts`
- `functions/lib/contract.ts`
- `functions/lib/validate.ts`
- `functions/api/audit.ts`
- `functions/lib/turnstile.ts`
- `tests/audit-retry.test.mjs`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- The stable `submission_id` semantics (still the persistence idempotency
  key — that is correct and must stay).
- The rate limiter, persistence, or any other trust-boundary behavior.
- Plan 008's `onRequest` refactor (it will move this wiring later; keep the
  wiring inside `onRequest` as-is here).

## Git workflow

- Branch: `improve/004-turnstile-idempotency-key`
- Commit message style (match the repo): `fix(audit): tie Turnstile idempotency key to the token, not the submission`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Observe the live endpoint's cross-token idempotency behavior (evidence for the report)

Write a short throwaway script in `/tmp` (NOT in the repo) using the official
Turnstile test credentials (always-pass sitekey `1x00000000000000000000AA`
and its matching test secret — do not use or mention any real founder
secret):

```js
// /tmp/turnstile-idem-probe.mjs
const secret = "1x0000000000000000000000000000000AA"; // official always-pass TEST secret
const endpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
async function verify(token, key) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, idempotency_key: key }),
  });
  return { status: res.status, body: await res.json() };
}
// same key, two different tokens:
console.log("T1/K1", await verify("token-A", "probe-key-1"));
console.log("T2/K1", await verify("token-B", "probe-key-1"));
```

Run `node /tmp/turnstile-idem-probe.mjs`. If there is no route to
challenges.cloudflare.com (network blocked), record that and skip — the fix
direction does not depend on the observation.

Record the output in your final report (and in the commit message body). The
key question: does `T2/K1` return the cached `T1/K1` result (`success: true`)
or a fresh/errored response? Either way, proceed to Step 2 — the per-token
key matches Cloudflare's documented pattern and removes the collision class.

### Step 2: Add the optional `turnstile_idempotency_key` to the contract

1. `functions/lib/contract.ts` — in `AuditSubmission`, after
   `cf_turnstile_token: string;` add:
   ```ts
   /** Optional per-token siteverify idempotency key (plan 004) — UUID,
    *  minted client-side per Turnstile token, never the submission_id. */
   turnstile_idempotency_key?: string;
   ```
2. `functions/lib/validate.ts` — after the `cf_turnstile_token` check, add:
   ```ts
   const turnstileIdem = str(raw.turnstile_idempotency_key);
   if (turnstileIdem !== undefined && !UUID_PATTERN.test(turnstileIdem)) {
     fail("turnstile_idempotency_key", "invalid_uuid");
   }
   ```
   and include `...(turnstileIdem !== undefined ? { turnstile_idempotency_key: turnstileIdem } : {})`
   in the returned value.
3. `functions/lib/turnstile.ts` — make the param optional:
   `idempotencyKey?: string` and build the body conditionally:
   ```ts
   if (idempotencyKey) body.idempotency_key = idempotencyKey;
   ```
   Update the doc comment: the key is per-token (never the submission_id).
4. `functions/api/audit.ts` `onRequest` — change the wiring to:
   ```ts
   idempotencyKey: submission.turnstile_idempotency_key,
   ```
   (absent → undefined → the key is simply not sent; siteverify remains valid).

**Verify**: `npm run check` exits 0; `node --test tests/audit-function.test.mjs` passes (existing fixtures don't send the new field, so they must keep passing).

### Step 3: Mint the key per token on the client

In `src/scripts/audit.ts`, `TurnstileBridge`:

1. Add a private field `private tokenKey: string | null = null;` and an accessor
   `currentIdempotencyKey(): string | null { return this.tokenKey; }`.
2. In `onToken(value)`: when `value` is non-null, mint a fresh key —
   `this.tokenKey = crypto.randomUUID(); this.token = value;` — so every NEW
   token gets a NEW key. When `value` is null (expired/error callbacks), set
   `this.tokenKey = null`.
3. In `invalidate()`, `retry()`, and `syncTheme()` — wherever `this.token = null`
   is set, also set `this.tokenKey = null`.
4. In `submit()` (the caller of `buildPayload`), pass the key:
   ```ts
   const payload = buildPayload(token, bridge?.currentIdempotencyKey() ?? null);
   ```
   and change `buildPayload(token: string, turnstileIdempotencyKey: string | null)` to
   include `turnstile_idempotency_key: turnstileIdempotencyKey ?? undefined`
   in the returned payload object.

**Verify**: `npm run check` exits 0.

### Step 4: Update and extend the tests

In `tests/audit-retry.test.mjs`:

1. Update the retry test's deepEqual assertion to exclude the new key:
   ```ts
   const withoutDynamic = (p) => ({ ...p, cf_turnstile_token: undefined, turnstile_idempotency_key: undefined });
   assert.deepEqual(withoutDynamic(env.auditCalls[1]), withoutDynamic(env.auditCalls[0]), "...");
   ```
2. Add assertions to the retry test:
   - `env.auditCalls[0].turnstile_idempotency_key` is a UUID string
     (match `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`);
   - `env.auditCalls[1].turnstile_idempotency_key !== env.auditCalls[0].turnstile_idempotency_key`
     (fresh token ⇒ fresh key — the regression this plan fixes).

In `tests/audit-function.test.mjs`:

3. Add a validate test: payload with `turnstile_idempotency_key: "not-a-uuid"`
   → `{ ok: false, fields: { turnstile_idempotency_key: "invalid_uuid" } }`;
   valid UUID → ok, value carries the key.
4. Add a request-level test: inject a recording `verifyTurnstile` into
   `handleAuditRequest` and assert it receives
   `idempotencyKey === payload.turnstile_idempotency_key` when present, and
   `undefined` when absent.
5. Add a `verifyTurnstile` unit test with a recording `fetchImpl` asserting
   the siteverify body contains `idempotency_key` when the param is set and
   does NOT contain it when undefined.

**Verify**: `node --test tests/audit-retry.test.mjs` and
`node --test tests/audit-function.test.mjs` → all pass. Red-before-green:
before Steps 2-3, test 2's "fresh key" assertion fails (both calls carry no
key / the same wiring), and the body-without-key unit test fails on the
unconditional `idempotency_key` line.

## Test plan

- 2 updated/2 new assertions in `tests/audit-retry.test.mjs` (key present as
  UUID; key changes across retry; deepEqual updated to exclude the dynamic
  key).
- 3 new tests in `tests/audit-function.test.mjs` (validation of the new
  field; pass-through to `verifyTurnstile`; siteverify body shape with/without
  the key).
- Pattern: the existing `verifyTurnstile` unit tests (lines ~370-430) use a
  recording `fetchImpl` — model the body-shape test on them.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-retry.test.mjs` exits 0 with the new-key assertions
- [ ] `node --test tests/audit-function.test.mjs` exits 0 with the 3 new tests
- [ ] `npm run check` exits 0; `npm run build` exits 0
- [ ] `grep -n "idempotencyKey: submission.submission_id" functions/api/audit.ts` → NO match (wiring changed)
- [ ] `grep -n "turnstile_idempotency_key" functions/lib/validate.ts src/scripts/audit.ts` → present
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The live probe (Step 1) shows behavior that contradicts the documented
  pattern in a way that suggests a different fix (e.g. siteverify REJECTS
  calls with an idempotency key for test credentials — then report and wait;
  do not switch the approach).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Plan 008 moves the `onRequest` wiring into a `buildAuditDeps` factory —
  preserve the `submission.turnstile_idempotency_key` wiring verbatim when
  doing so.
- The client mints a key per emitted token; if a future change re-sends the
  SAME token (e.g. an optimistic retry before the widget resets), the key
  must be reused for that token — the `tokenKey` lives on the bridge and is
  cleared only when the token is discarded, so this holds by construction.
- The `submission_id` remains the persistence idempotency key
  (`on_conflict submission_id` upsert) — do not conflate the two roles when
  reviewing future changes.
