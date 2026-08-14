# Plan 008: Test the Pages Function env-wiring boundary (buildAuditDeps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- functions/api/audit.ts tests/audit-function.test.mjs`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. NOTE: plan 004 may have changed the
> `verifyTurnstile` wiring inside `onRequest` (the idempotency key source);
> preserve whatever the current wiring is verbatim when moving it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — touches the production boundary; behavior must stay
  identical, only the construction is factored out.
- **Depends on**: plans/004-turnstile-idempotency-key.md (the wiring being
  moved includes the per-token idempotency key; land 004 first so the moved
  code is the final shape)
- **Category**: tests
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The single place secrets are wired (`functions/api/audit.ts` `onRequest`,
lines 123-137: reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`TURNSTILE_SECRET_KEY` from env and constructs the persister/verifier) is
untested: `tests/audit-function.test.mjs:29-32` imports only
`handleAuditRequest` and `toLeadRow`, so a renamed env var, a changed
persister signature, or a swapped secret would ship silently until a real
submission 500s at deploy time. Contrast: `eventsOnRequest` IS tested with
injected env (`audit-function.test.mjs:742-810`). This plan factors the
wiring into a testable `buildAuditDeps(env)` factory (behavior-identical for
`onRequest`) and proves the wiring end-to-end against the existing mock
PostgREST server with no real network.

## Current state

`functions/api/audit.ts` (lines ~123-137):

```ts
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> => {
  const { request, env } = context;
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    persistLead: (row) => createSupabasePersister(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).persistLead(row),
    verifyTurnstile: (submission, ip) =>
      verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: submission.cf_turnstile_token,
        remoteIp: ip,
        idempotencyKey: submission.submission_id,   // ← plan 004 changes this to submission.turnstile_idempotency_key
      }),
  });
};
```

`AuditDeps` interface (lines ~19-29) — `verifyTurnstile`, `persistLead`,
`rateLimiter`, `now?`. `handleAuditRequest` (lines ~34-121) is the tested
core. `verifyTurnstile` already accepts a `fetchImpl?: typeof fetch` param
(`functions/lib/turnstile.ts:22`).

The test file's helpers: `startMockSupabase(up)` starts the in-process mock
PostgREST server and returns `{ url, close }`; `post(payload)` builds POST
requests; `validPayload()` is the fixture. See the existing test
"supabase-js insert path: full request maps Supabase failure to 502" (line
~690) for the pattern.

## Repo conventions to match

- Dependencies are injected explicitly (`handleAuditRequest` takes
  `AuditDeps`) — the factory follows the same philosophy one level up.
- The module-scope `limiter` stays module-scope (per-isolate by design);
  the factory reuses it.
- Tests never hit the real siteverify endpoint except the skip-gated
  real-endpoint tier; use a recording `fetchImpl` here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Build | `npm run build` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file functions/api/audit.ts` | routes to the functions lane |

## Scope

**In scope** (the only files you should modify):
- `functions/api/audit.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `functions/lib/*` — no behavior changes there.
- `functions/api/events.ts` (plan 002 territory).
- `src/**` client code.

## Git workflow

- Branch: `improve/008-onrequest-env-wiring-test`
- Commit message style (match the repo): `test(functions): prove the env wiring boundary via buildAuditDeps`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `buildAuditDeps`

In `functions/api/audit.ts`, replace the `onRequest` body with a factory
plus a thin `onRequest`:

```ts
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

/** Wire the real implementations from Pages env (testable factory). */
export function buildAuditDeps(
  env: AuditEnv,
  turnstileFetch?: typeof fetch,
): AuditDeps {
  return {
    rateLimiter: limiter,
    persistLead: (row) =>
      createSupabasePersister(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).persistLead(row),
    verifyTurnstile: (submission, ip) =>
      verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: submission.cf_turnstile_token,
        remoteIp: ip,
        // plan 004: the idempotency key is the per-token client key
        idempotencyKey: submission.turnstile_idempotency_key,
        fetchImpl: turnstileFetch,
      }),
  };
}

export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> =>
  handleAuditRequest(context.request, buildAuditDeps(context.env));
```

(The `idempotencyKey` line must match whatever plan 004 left in place —
copy it verbatim, including any optionality.)

**Verify**: `npm run check` exits 0; `node --test tests/audit-function.test.mjs` → all existing tests still pass (behavior unchanged).

### Step 2: Prove the wiring with tests

In `tests/audit-function.test.mjs`, import `buildAuditDeps` alongside
`handleAuditRequest`, then add:

1. **Persister wired to env.SUPABASE_URL**: start the mock PostgREST;
   `const deps = buildAuditDeps({ SUPABASE_URL: mock.url,
   SUPABASE_SERVICE_ROLE_KEY: "svc-key", TURNSTILE_SECRET_KEY: "ts-key" })`;
   call `handleAuditRequest(post(validPayload()), deps)` with
   `deps.verifyTurnstile` backed by a recording fetch (below) returning
   `{ success: true }` → expect 200 and one row in the mock (mirror the
   existing 502 test's assertions, inverted). This proves
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` reach the persister.
2. **Verifier wired to env.TURNSTILE_SECRET_KEY**: a recording
   `fetchImpl` that captures the siteverify request body and returns
   `new Response(JSON.stringify({ success: true }), { status: 200 })`;
   pass it as the second arg; after the request, assert the recorded body's
   `secret === "ts-key"` and `response === payload.cf_turnstile_token`.
3. **Wrong/absent secret → 403, nothing persisted**: `buildAuditDeps({ ...,
   TURNSTILE_SECRET_KEY: "wrong" })` with the recording fetch returning
   `{ success: false, "error-codes": ["invalid-input-secret"] }` → 403,
   mock has zero rows.
4. **Missing env vars do not throw at construction**: `buildAuditDeps({})`
   returns a deps object (construction succeeds); the failure surfaces at
   request time (persist 502) — assert that, documenting current behavior.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass,
including the 4 new tests. Red-before-green: before Step 1, `buildAuditDeps`
does not exist (import fails) — the refactor is the enabling change.

## Test plan

- 4 new tests in `tests/audit-function.test.mjs` (wiring proof for
  persister, verifier secret, rejection path, missing-env behavior).
- Pattern: the existing "supabase-js insert path" tests (~lines 680-705)
  — same mock server, same `handleAuditRequest` invocation style.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-function.test.mjs` exits 0 with the 4 new tests
- [ ] `npm run check` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "buildAuditDeps" functions/api/audit.ts tests/audit-function.test.mjs` → both files
- [ ] `onRequest` still exported and delegates to `buildAuditDeps` (grep shows `export const onRequest`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (plan 004 may have changed the wiring — reconcile with the live code; if
  the drift is bigger than the idempotency-key line, STOP).
- A step's verification fails twice after a reasonable fix attempt.
- The refactor appears to require touching an out-of-scope file.

## Maintenance notes

- `onRequest` remains the Pages runtime contract — keep its export shape
  (`(context: { request, env }) => Promise<Response>`); wrangler/Pages
  resolves it by name.
- When env var names change, `buildAuditDeps` is now the single place to
  update — and the new tests will fail red if a name is missed.
- The `now` dep of `AuditDeps` is slated for removal by plan 018; do not
  propagate it into `buildAuditDeps`.
