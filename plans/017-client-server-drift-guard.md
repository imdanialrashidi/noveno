# Plan 017: Extend the client↔server drift guard to payload keys and event names

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- tests/audit-function.test.mjs tests/audit-retry.test.mjs functions/lib/contract.ts src/scripts/audit.ts src/scripts/analytics.ts`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. NOTE: plan 013 may have added
> `utm_source`/`utm_medium`/`utm_campaign` to `EVENT_PAYLOAD_KEYS` and the
> client payload — the literals below must match the code at execution time.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/013-utm-funnel-events.md (so the guard's client
  event-payload literals match the final key set)
- **Category**: tech-debt
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The client/server field contract is hand-maintained in three places —
`src/data/audit.ts` (form field ids + `AUDIT_STEPS`), `src/scripts/audit.ts`
(`buildPayload` key mapping), and `functions/lib/contract.ts` +
`functions/lib/validate.ts` (the authoritative `AuditSubmission` keys) —
and the analytics event names/payload keys are duplicated between
`src/scripts/analytics.ts` (`EventName` union) and `functions/lib/contract.ts`
(`EVENT_NAMES` / `EVENT_PAYLOAD_KEYS`). The only existing drift guard is the
option-ids test (`tests/audit-function.test.mjs` "client option ids are
exactly the server enum whitelists"); nothing guards the payload KEY sets.
Impact today is LOW (drift fails loudly at runtime: the server 400s unknown
fields and the events endpoint 400s unknown keys) — this plan converts that
runtime failure into a build-time test failure, which is strictly cheaper
and catches drift before any visitor hits it.

## Current state

- `tests/audit-function.test.mjs:709-727` — the existing drift test
  (`pairs` of client option ids vs server enum arrays). Add the new tests
  in the same file, near it.
- The retry harness (`tests/audit-retry.test.mjs`) captures the REAL client
  payload: `env.auditCalls[0]` is the exact JSON body `buildPayload`
  produced (keys: `submission_id`, `company_website` (honeypot), `name`,
  `phone`, `email?`, `preferred_contact`, `business_name?`, `industry`,
  `website?`, `acquisition_channels`, `primary_problem`,
  `requested_service`, `customer_value_range?`, `cf_turnstile_token`,
  `turnstile_idempotency_key?` (plan 004), `attribution { landing_page,
  referrer, utm_source?, utm_medium?, utm_campaign?, utm_content?,
  utm_term?, first_seen_at? }`).
- `functions/lib/contract.ts` — `AuditSubmission` interface (lines
  ~136-161) and `HONEYPOT_FIELD = "company_website"` (~line 115).
- `src/scripts/analytics.ts:7-18` — `EventName` union of 10 names;
  `EVENT_PAYLOAD_KEYS` in `contract.ts:82-87` (+ plan 013's utm keys).
- `validateEvent` in `functions/api/events.ts` — the runtime authority for
  event names/keys.

## Repo conventions to match

- Test literals mirroring another module get a comment naming the source
  module and the "keep in sync" intent (the existing drift test's comment
  style: "client options … drifted from server whitelist").
- Behavior-level assertions preferred: drive the real client (retry
  harness) rather than re-declaring `buildPayload`'s shape.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs tests/audit-retry.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |

## Scope

**In scope** (the only files you should modify):
- `tests/audit-function.test.mjs`
- `tests/audit-retry.test.mjs`

**Out of scope** (do NOT touch):
- `functions/lib/contract.ts`, `src/scripts/audit.ts`,
  `src/scripts/analytics.ts`, `src/data/audit.ts` — production files; if a
  guard fails against current code, that IS the drift being caught — fix
  the drift per the failure message or STOP and report if the fix is
  non-obvious.
- Plan 003's `ATTR_LIMITS` mirror and plan 013's `EVENT_VALUE_LIMIT` —
  constant-level drift guarding is noted in those plans' maintenance notes;
  do not expand scope here beyond key sets.

## Git workflow

- Branch: `improve/017-drift-guard`
- Commit message style (match the repo): `test(functions): guard client payload keys and event names against the server contract`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Guard the audit payload key set (behavior-level)

In `tests/audit-retry.test.mjs`, add a test that runs the real journey and
asserts the captured payload's keys:

```js
test("client audit payload keys are exactly the server contract keys", async () => {
  // Server-side authoritative keys — mirror of functions/lib/contract.ts
  // AuditSubmission + HONEYPOT_FIELD (company_website is read raw by
  // validate.ts honeypotTriggered). Keep in sync with contract.ts.
  const SERVER_TOP_LEVEL_KEYS = new Set([
    "submission_id", "company_website", "name", "phone", "email",
    "preferred_contact", "business_name", "industry", "website",
    "acquisition_channels", "primary_problem", "requested_service",
    "customer_value_range", "cf_turnstile_token",
    "turnstile_idempotency_key", // plan 004
    "attribution",
  ]);
  const SERVER_ATTRIBUTION_KEYS = new Set([
    "landing_page", "referrer", "utm_source", "utm_medium", "utm_campaign",
    "utm_content", "utm_term", "first_seen_at",
  ]);

  const turnstile = makeTurnstileMock();
  const env = installGlobals({ turnstile, fetchImpl: [okResponse] });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "", web3formsUrl: "" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  await tick();

  assert.equal(env.auditCalls.length, 1);
  const payload = env.auditCalls[0];
  for (const key of Object.keys(payload)) {
    assert.ok(SERVER_TOP_LEVEL_KEYS.has(key), `client payload key "${key}" is not in the server contract`);
  }
  for (const key of Object.keys(payload.attribution)) {
    assert.ok(SERVER_ATTRIBUTION_KEYS.has(key), `attribution key "${key}" is not in the server contract`);
  }
});
```

(Trim the literal to match the actual payload at execution time — plan 004
adds `turnstile_idempotency_key`; if it hasn't landed, drop that entry and
add it when it does. The test fails red if the payload ever carries a key
the server ignores.)

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

### Step 2: Guard the analytics event names and payload keys

In `tests/audit-function.test.mjs`, add:

```js
test("client event names and payload keys are subsets of the server whitelists", () => {
  // Mirrors of src/scripts/analytics.ts EventName union and the keys the
  // client actually sends (track calls + data-event-payload attributes).
  const CLIENT_EVENT_NAMES = [
    "primary_cta_click", "secondary_cta_click", "audit_started",
    "audit_step_completed", "audit_submitted", "phone_click",
    "messaging_click", "service_opened", "case_study_opened",
    "project_opened",
  ];
  const CLIENT_EVENT_PAYLOAD_KEYS = [
    "page", "section", "cta_id", "step", "service", "slug", "channel",
    "utm_source", "utm_medium", "utm_campaign", // plan 013
  ];

  for (const name of CLIENT_EVENT_NAMES) {
    assert.ok(EVENT_NAMES.includes(name), `client event "${name}" is not in EVENT_NAMES`);
  }
  for (const key of CLIENT_EVENT_PAYLOAD_KEYS) {
    assert.ok(EVENT_PAYLOAD_KEYS.includes(key), `client payload key "${key}" is not in EVENT_PAYLOAD_KEYS`);
  }
});
```

(Import `EVENT_NAMES` and `EVENT_PAYLOAD_KEYS` from
`functions/lib/contract.ts` — the existing drift test already imports the
enum arrays from there.) Update the payload-keys literal if plan 013 landed
with a different key set.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass.

## Test plan

- 1 new test in `tests/audit-retry.test.mjs` (payload key set, behavior-level).
- 1 new test in `tests/audit-function.test.mjs` (event names + payload keys).
- Pattern: the existing option-ids drift test for style; the retry harness
  for the behavior-level capture.
- Red demonstration: temporarily add a bogus key to `buildPayload` (or to
  the `EventName` union) and confirm the corresponding new test fails —
  then revert. Record the red evidence in the commit message.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-function.test.mjs tests/audit-retry.test.mjs` exits 0 with the 2 new tests
- [ ] `npm run check` exits 0; `npm run test` exits 0
- [ ] No production files modified (`git status` shows only the two test files)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A guard FAILS against the current production code — that is the drift
  being caught. If the failure is explained by a not-yet-landed plan (e.g.
  `turnstile_idempotency_key` when plan 004 hasn't landed), adjust the
  literal to the current code and note it. If it is genuine unexplained
  drift, STOP and report rather than editing production code.
- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Every future payload/event change must update these literals in the SAME
  change — the guard is only as honest as its mirrors; the comments name
  the source modules so the update is discoverable.
- Plan 003's `ATTR_LIMITS` and plan 013's `EVENT_VALUE_LIMIT` are
  constant-level mirrors not covered by this plan — consider a follow-up
  guard (importing the server constants is forbidden by the client/server
  split; a test-side comparison of the literal numbers is the workable
  shape) if those limits ever change.
- The honeypot field (`company_website`) is the one client key the server
  reads without `AuditSubmission` membership — the guard's literal includes
  it deliberately; do not "fix" that asymmetry.
