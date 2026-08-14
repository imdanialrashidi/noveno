# Plan 005: Bound the Web3Forms notification wait before the thank-you redirect

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- src/scripts/audit.ts tests/audit-retry.test.mjs`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-client-submit-and-web3forms-coverage.md (its
  Web3Forms tests must land first so this change is protected)
- **Category**: bug
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

After a confirmed 200 from `/api/audit` (the lead is safely in Supabase),
`onSuccess` awaits `notifyWeb3Forms(payload)` — up to two attempts × 2.5 s
timeout — before navigating to `/audit/thank-you` (`src/scripts/audit.ts:671-672`).
The launch plan specified the opposite: "awaited via `Promise.race` with a
short timeout (≈2.5 s), one automatic retry; then navigate to thank-you
regardless of outcome" (`docs/exec-plans/active/noveno-launch.md:158`). The
delivered summary even claims "≤2.5s race … never blocks thank-you" — the
code does not implement it. Worst case the visitor stares at «در حال ارسال…»
for ~5 s after their lead is already saved; closing the tab in that window
skips the thank-you page (the draft is already cleared). A4-iii already
guarantees the lead is never lost on notification failure — this change only
stops the UI from waiting on a convenience email.

## Current state

`src/scripts/audit.ts`:

```ts
  async function onSuccess(payload: Record<string, unknown>): Promise<void> {
    track("audit_submitted");
    clearDraft();
    try {
      sessionStorage.setItem(DONE_KEY, String(payload.submission_id ?? ""));
    } catch {
      /* noop */
    }
    await notifyWeb3Forms(payload);
    window.location.assign("/audit/thank-you");
  }
```

`notifyWeb3Forms` (lines ~677-727): two attempts, each a `fetch(..., {
keepalive: true, signal: AbortSignal.timeout(2500) })`; returns after one
`result.ok` or after both attempts. `keepalive: true` is already set — a
fetch that survives navigation — so nothing about the notification's
delivery depends on the page waiting.

## Repo conventions to match

- The banner/redirect logic is asserted in `tests/audit-retry.test.mjs`
  through `env.nav` (the recorded `location.assign` calls) — assert
  behavior, not timing, except for the one slow test below.
- Keep Persian copy untouched; this plan changes no strings.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/scripts/audit.ts`
- `tests/audit-retry.test.mjs`

**Out of scope** (do NOT touch):
- `notifyWeb3Forms`'s two-attempt loop and `AbortSignal.timeout(2500)` —
  those stay; only the caller's wait is bounded.
- The Web3Forms provider choice (forbidden to change without approval per
  `docs/ops/runbook.md`).
- Moving the redirect BEFORE the notification entirely (fire-and-forget) —
  considered and rejected: the written plan says race-then-navigate; keep
  plan-conformance. (Noted in Maintenance notes as a future option.)

## Git workflow

- Branch: `improve/005-thankyou-redirect-race`
- Commit message style (match the repo): `fix(audit): bound the Web3Forms wait before the thank-you redirect (plan §5.6)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the race constant and bound the wait

In `src/scripts/audit.ts`:

1. Near the top constants (`DRAFT_KEY` etc.), add:
   ```ts
   /** Plan §5.6: the notification may never block thank-you beyond this. */
   const NOTIFY_DEADLINE_MS = 2500;
   ```
2. In `onSuccess`, replace `await notifyWeb3Forms(payload);` with:
   ```ts
   // Notification is convenience-only (A4-iii): bound the wait, then
   // navigate regardless of outcome. keepalive on the fetch (already
   // set in notifyWeb3Forms) carries the request across navigation.
   await Promise.race([
     notifyWeb3Forms(payload),
     new Promise<void>((resolve) => setTimeout(resolve, NOTIFY_DEADLINE_MS)),
   ]);
   window.location.assign("/audit/thank-you");
   ```

**Verify**: `npm run check` exits 0; `node --test tests/audit-retry.test.mjs` still passes (the existing Web3Forms tests from plan 001 keep passing — they already assert navigation after success/failure).

### Step 2: Add the bounded-wait regression test

In `tests/audit-retry.test.mjs`, add a test (mark it with a longer timeout so
the suite doesn't flake):

```js
test("thank-you navigation is not blocked by a hanging Web3Forms notification (plan §5.6)", { timeout: 6000 }, async () => {
  const turnstile = makeTurnstileMock();
  // First fetch serves /api/audit; the web3forms fetch never settles.
  const fetchImpl = [okResponse, () => new Promise(() => {})];
  const env = installGlobals({ turnstile, fetchImpl, web3formsUrl: "https://web3forms.test/submit" });
  const dom = buildAuditDom();
  globalThis.document = dom.document;
  captureScripts();
  initAudit({ turnstileSiteKey: "test-site-key", web3formsKey: "test-key", web3formsUrl: "https://web3forms.test/submit" });
  await walkToContactStep(dom);
  dom.getElementById("audit-next").dispatchEvent("click");
  await tick();
  turnstile.emitToken("token-1");
  const t0 = Date.now();
  // Wait for navigation with a generous bound (the race fires at 2.5 s).
  while (env.nav.length === 0 && Date.now() - t0 < 4000) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(env.nav[0], "/audit/thank-you", "navigation must happen despite the hanging notification");
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 2000, `navigation raced out too early (${elapsed}ms) — the notification wait is not being bounded`);
  assert.ok(elapsed <= 4000, `navigation took too long (${elapsed}ms) — the wait is not bounded at ~2.5s`);
});
```

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass, including
the new slow test. Red-before-green: run the new test against the pre-change
`onSuccess` (stash step 1) — it must fail (no navigation within 4 s because
both attempts hang; the test's `while` loop exits at 4 s with
`env.nav.length === 0`).

## Test plan

- 1 new slow test (deterministic: hanging web3forms fetch, navigation
  observed between 2 s and 4 s). This is the only timing-based test in the
  suite — the 2.5 s race constant is asserted through it.
- Existing plan 001 tests cover: notification success (navigates), failure
  ×2 (navigates) — those must keep passing unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-retry.test.mjs` exits 0 with the new timing test
- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "NOTIFY_DEADLINE_MS" src/scripts/audit.ts` → defined and used in `onSuccess`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The new timing test is flaky in CI (timing-based tests can be): first try
  widening the elapsed bounds (2.0-4.0 s) — if it still flakes, STOP and
  report rather than deleting the test.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- `notifyWeb3Forms` keeps its own per-attempt 2.5 s `AbortSignal.timeout`;
  with the race, the first attempt's timeout and the race deadline fire at
  the same moment, so the second attempt effectively never runs for a
  hanging first attempt — that is the intended "one retry for fast failures,
  bounded total wait" behavior. A reviewer should confirm the fetch's
  `keepalive: true` remains after this change (it is what lets the email
  still send after navigation).
- Future option (not taken): navigate before calling `notifyWeb3Forms`
  entirely (`void notifyWeb3Forms(payload); window.location.assign(...)`) —
  strictly better UX, but deviates from the written plan; requires an
  explicit plan amendment if ever wanted.
- If `NOTIFY_DEADLINE_MS` is ever made configurable, the timing test's
  bounds must be derived from it.
