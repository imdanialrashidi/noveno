# Plan 025: Document and mitigate duplicate Web3Forms deliveries after the email-only cutover

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- functions/api/audit.ts src/scripts/audit.ts tests/audit-function.test.mjs tests/audit-retry.test.mjs docs/ARCHITECTURE.md docs/ops/runbook.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 021 (receipt mitigation — builds on its `validation_receipt` seam if present; run 021 first)
- **Category**: correctness
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`3e33265` removed `functions/lib/persist.ts` and the `submission_id` dedupe — the server is now validate-only, and the inbox receives one Web3Forms email per delivery attempt. `src/scripts/audit.ts:773` retries Web3Forms once on failure, and the «تلاش دوباره» banner re-validates with the same `submission_id` but a fresh Turnstile token. Owner triage must distinguish retries from distinct leads, but the current contract only puts `submission_id` in the email subject/body — there's no documented dedupe procedure and no client-side guard against accidental double-click duplicates within the bounded retry window. This plan makes the trade-off explicit and adds cheap client-side mitigations so duplicates are recognizable and bounded, until `D-01` (server-side email) can enforce true dedupe with a store.

## Current state

Relevant files:
- `functions/api/audit.ts:110` — validate-only return `{ ok:true, status:"validated" }`; deleted `functions/lib/persist.ts:91`
- `src/scripts/audit.ts:133` (`createDraft`), `:772-790` (`deliverLead` bounded 2-attempt), `:807` (`access_key` + `submission_id` in body), `:133` stable `submission_id` across retry
- `tests/audit-function.test.mjs:330` — `"duplicate submission_id still validates — no replay/dedupe machinery"`
- `tests/audit-retry.test.mjs:799-830` — `"Web3Forms failure … bounded retry"` asserts exactly 2 delivery attempts, plus retry with same `submission_id`

Excerpt — `functions/api/audit.ts:22-50` (rate + validation only, no store):

```ts
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });
// ...
if (response.ok) {
  // The server contract guarantees 200 ⇔ validated. Verify it when the body is readable
}
// Validation accepted — this is a validation-success response, NOT a persistence or delivery confirmation.
return jsonResponse({ ok: true, status: "validated" }, 200);
```

Excerpt — `src/scripts/audit.ts:772-792` (bounded delivery):

```ts
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await fetch(config.web3formsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = result.status;
      let accepted = false;
      try {
        const parsed = (await result.json()) as { success?: boolean };
        accepted = result.ok && parsed?.success === true;
      } catch { accepted = false; }
      if (accepted) return { ok: true };
    } catch {}
  }
  return { ok: false, rateLimited: lastStatus === 429 };
```

Excerpt — `tests/audit-function.test.mjs:330`:

```ts
test("duplicate submission_id still validates — no replay/dedupe machinery (email-only trade-off)", async () => {
  const submissionId = crypto.randomUUID();
  const { deps } = makeDeps();
  const first = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  const second = await handleAuditRequest(post(validPayload({ submission_id: submissionId })), deps);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
});
```

Repo conventions:
- Email subject already carries `submission_id` via `src/scripts/audit.ts:809` `subject: "درخواست بررسی مسیر جذب — …"`, `submission_id` field in body; `safeText` strips `<`/`>` before email.
- Tests use `node:test` + `node:assert/strict`; follow `tests/audit-retry.test.mjs` harness for delivery counts (`web3Posts(env).length`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass (duplicate test still passes — still validates) |
| Build | `npm run build` | 19 pages |
| Docs check | `bash scripts/project-verify.sh` | no contract failures |

## Scope

**In scope** (only files you should modify):
- `src/scripts/audit.ts` — add client-side double-submit guard + delivery attempt marker
- `docs/ARCHITECTURE.md` — document dedupe trade-off + recognizability via `submission_id`
- `docs/ops/runbook.md` or `docs/ops/setup-checklist.md` — inbox triage procedure (how to recognize duplicate `submission_id`)
- `tests/audit-retry.test.mjs` — pin that bounded retry is exactly 2 and that `submission_id` stable across retry

**Out of scope** (do NOT touch):
- Re-adding `functions/lib/persist.ts` or any Supabase/KV/D1 store (that's `D-01`)
- `functions/api/audit.ts` server dedupe (no store → impossible; don't fake it in memory)
- Changing `functions/lib/validate.ts` attribution logic (plan 020)

## Git workflow

- Branch: `advisor/025-email-only-dedupe-tradeoff`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Add a client-side double-submit guard and attempt marker (bounded, never infinite)

In `src/scripts/audit.ts`, the `submit()` path already has `if (submitting) return` at `:615` and `setSubmitting(true)` at `:635`. Tighten it for the Web3Forms window:

1. Around `deliverLead`, add a delivery-attempt counter to the email body:
   ```ts
   // buildWeb3FormsBody — add delivery_attempt: String(attempt + 1) ("1" | "2")
   // and submission_id already present at body.submission_id
   ```
   Pass `attempt` into `buildWeb3FormsBody` or thread it via `deliverLead`. The email now shows whether it was the first or retried delivery — triage is O(1) in the inbox search.

2. Ensure the `submitting` guard covers the entire `validation fetch → deliverLead` window (it already does: `setSubmitting(true)` before validation fetch, `setSubmitting(false)` on any failure path, only `onSuccess` navigates away). No extra guard needed, but add a comment at `if (submitting) return` explaining the window.

3. Do NOT add a debounce/throttle beyond the existing guard — the bounded 2-attempt loop at `:773` is the retry contract; a second click while `deliverLead` is in-flight should be a no-op (already is via `submitting`).

**Verify**: `npm run check` → exit 0

### Step 2: Document the trade-off and triage procedure

Update two docs:

1. `docs/ARCHITECTURE.md` — in the Lead delivery row, replace or append: "Email-only trade-off (2026-10, plan 025): no server-side dedupe — duplicate `submission_id` values in the inbox mean the same journey retried (network/429). Bounded to 2 delivery attempts per submit; manual «تلاش دوباره» may produce a third email with the same `submission_id` and a higher `delivery_attempt`. Filter by `submission_id` to deduplicate; `D-01` moves dedupe server-side."

2. `docs/ops/runbook.md` (or `docs/ops/setup-checklist.md` if `runbook.md` missing — check both) — add a "Duplicate emails" subsection: "Search the inbox for `submission_id: <uuid>` — if multiple messages share the same ID, keep the last `delivery_attempt`. No action needed beyond triage; the lead is the same `submission_id` with stable field values. Retire manual dedupe after `D-01`."

**Verify**: `grep -rn "submission_id" docs/ARCHITECTURE.md docs/ops/` returns hits

### Step 3: Tests — pin bounded retry and stable submission_id

Extend `tests/audit-retry.test.mjs` (or add assertions to existing tests):

- Existing test at `:776` `"Web3Forms failure (network): … bounded retry"` already asserts `web3Posts(env).length === 2` and `submission_id` stable across retry. Keep it.
- Add or extend the `"Web3Forms success: exactly one delivery POST …"` test at `:724` to assert `delivery_attempt` (if you added it) is `"1"` on success, and that `submission_id` matches `env.auditCalls[0].submission_id`.
- Add a new test `"rapid double-click does not double-deliver"` — drive `initAudit`, `walkToContactStep`, stub `/api/audit` to delayed `okResponse` (e.g., `await sleep(50)` before resolving), click `audit-next` twice within the `submitting` window, assert `web3Posts(env).length === 1` (guard holds) and `env.auditCalls.length === 1`.

If you added `delivery_attempt`, update the success test to assert `JSON.parse(web3Posts(env)[0].body).delivery_attempt === "1"`.

**Verify**: `npm test` → all pass

### Step 4: Build and verify email body shape

**Verify**: `npm run build` → 19 pages; spot-check that the Web3Forms body keys are documented (no `cf_turnstile_token`, no `company_website` honeypot) — existing assertions at `tests/audit-retry.test.mjs:764-765` already pin these.

## Test plan

- `rapid double-click does not double-deliver` — new test, `submitting` guard proven.
- `Web3Forms success: exactly one delivery POST …` — extended to assert `delivery_attempt === "1"` and `submission_id` stability.
- `Web3Forms failure (network): … bounded retry` — already asserts 2 attempts; extend to assert second attempt's `delivery_attempt === "2"`.
- `duplicate submission_id still validates` — no change (still 200).
- Verification: `npm test` → all pass, `grep -rn "delivery_attempt" src/scripts/audit.ts tests/` returns hits

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new test `rapid double-click does not double-deliver` exists and passes
- [ ] `grep -rn "delivery_attempt" src/scripts/audit.ts` returns a hit (attempt marker)
- [ ] `grep -rn "submission_id" docs/ARCHITECTURE.md` returns a hit (documented triage)
- [ ] `grep -rn "cf_turnstile_token" src/scripts/audit.ts` still negative in Web3Forms body builder (neg check: `body` construction must not include it)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- Adding `delivery_attempt` to the Web3Forms body changes the Web3Forms API contract (field rejected by Web3Forms — Web3Forms accepts arbitrary keys, but verify against `https://docs.web3forms.com` — extra fields are custom keys and are emailed)
- The `submitting` guard already covers the window and the new double-click test shows 2 deliveries even before your change (guard was not wired — fix guard before adding marker)
- `D-01` has been implemented (server-side email now exists) — this trade-off doc is then historical; mark REJECTED with rationale
- Any existing audit-retry test now fails on `submission_id` stability (you changed `createDraft` semantics — wrong seam)

## Maintenance notes

- This is a **bridge** until `D-01` — do not build a durable dedupe without a store. In-memory Maps are per-isolate and not durable.
- Reviewer should ensure the inbox subject still carries `business_name` or `name` fallback at `src/scripts/audit.ts:809` so search by `submission_id` + name is fast.
- When `D-01` lands, remove `delivery_attempt` from the Web3Forms body if Web3Forms is removed, or keep it as `X-Delivery-Attempt` header on the server email seam.
