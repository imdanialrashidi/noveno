# Plan 002: Suppress duplicate email + conversion event on replay 200

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- functions/ src/scripts/audit.ts tests/`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-turnstile-idempotency-per-attempt.md (already applied; same files)
- **Category**: security
- **Planned at**: commit `13ef792`

## Why this matters

The server persists leads idempotently: a duplicate `submission_id` returns
200 with `status: "replay"` and the existing row's id. But the client treats
every 200 the same: it fires `track("audit_submitted")` and posts the full
PII lead (name, phone, email, business, attribution) to Web3Forms. The exact
scenario the retry banner exists for — server persisted, response lost —
therefore produces a **duplicate PII email** to the founder and a
**double-counted conversion** in analytics. One lead row, two emails, two
conversions. The fix threads the insert/replay status through the 200
response and skips the side effects on replay.

## Current state

- `functions/lib/persist.ts:68-73` — `persistLead` returns
  `{ status: "inserted" | "replay", id }` (replay = duplicate `submission_id`).
- `functions/api/audit.ts:80-84`:
  ```ts
  const persisted = await deps.persistLead(toLeadRow(submission, submittedAt));
  // 200 ⇔ Supabase accepted the row (fresh insert or idempotent replay).
  return jsonResponse({ ok: true, id: persisted.id }, 200);
  ```
- `src/scripts/audit.ts:645-650`:
  ```ts
  if (response.ok) {
    await onSuccess(payload);
    return;
  }
  ```
- `src/scripts/audit.ts:685-700`:
  ```ts
  async function onSuccess(payload: Record<string, unknown>): Promise<void> {
    track("audit_submitted");
    clearDraft();
    try { sessionStorage.setItem(DONE_KEY, String(payload.submission_id ?? "")); } catch { /* noop */ }
    void notifyWeb3Forms(payload);   // full PII → Web3Forms (best-effort)
    window.location.assign("/audit/thank-you");
  }
  ```
- `functions/lib/respond.ts` — `jsonResponse(body, status)` = `JSON.stringify(body)` with JSON content-type.

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Boundary tests | `node --test tests/audit-function.test.mjs` | all pass |
| Client tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

If `npm ci` fails with a package.json/lockfile mismatch, use `npm install`
instead (another plan updates the lockfile later).

## Scope

**In scope**:
- `functions/api/audit.ts`
- `src/scripts/audit.ts`
- `tests/audit-function.test.mjs`
- `tests/audit-retry.test.mjs`

**Out of scope** (do NOT touch):
- `functions/lib/persist.ts`, `functions/lib/contract.ts`, `functions/lib/respond.ts`
- `src/scripts/analytics.ts`
- Any other file.

## Git workflow

- Commit once at the end: `fix(security): skip duplicate lead email and conversion event on replay 200`
- Do NOT push or open a PR.

## Steps

### Step 1: Server — include the persist status in the 200 body

In `functions/api/audit.ts`, change the success response:

```ts
return jsonResponse({ ok: true, id: persisted.id, status: persisted.status }, 200);
```

Update the surrounding comment: 200 with `status: "replay"` means the lead
already exists — the client must not re-notify.

**Verify**: `node --test tests/audit-function.test.mjs` — existing tests may
assert the exact 200 body; if any fails, update ONLY the shape assertions
(`ok: true`, `id`) to also expect `status: "inserted"` where the stub
persister returns inserted. Do not weaken assertions.

### Step 2: Client — parse the status and skip side effects on replay

In `src/scripts/audit.ts`, in `submit()` where `response.ok` is handled,
read the body first:

```ts
if (response.ok) {
  let replay = false;
  try {
    const body = (await response.json()) as { status?: string };
    replay = body.status === "replay";
  } catch {
    /* body unreadable — treat as fresh insert (default) */
  }
  await onSuccess(payload, replay);
  return;
}
```

Change `onSuccess` to:

```ts
async function onSuccess(payload: Record<string, unknown>, replay = false): Promise<void> {
  if (!replay) {
    track("audit_submitted");
    void notifyWeb3Forms(payload); // only a fresh insert may notify/event
  }
  clearDraft();
  try { sessionStorage.setItem(DONE_KEY, String(payload.submission_id ?? "")); } catch { /* noop */ }
  window.location.assign("/audit/thank-you");
}
```

Note: the thank-you page still opens on replay — the user's journey is
identical; only the duplicate side effects are suppressed. `track`/`notify`
stay best-effort and non-blocking.

**Verify**: `node --test tests/audit-retry.test.mjs` — existing success-mock
responses in the harness may lack `status`; that is fine (defaults to
inserted), but update the mocks that represent the retry-success journey to
return `{ ok: true, id: "...", status: "inserted" }` for clarity.

### Step 3: Regression tests

In `tests/audit-function.test.mjs`:

- **Replay 200 carries status**: `handleAuditRequest` with `persistLead`
  returning `{ status: "replay", id: "x" }` → response body has
  `status: "replay"`; with `{ status: "inserted", ... }` → `status: "inserted"`.

In `tests/audit-retry.test.mjs` (follow the existing harness — `initAudit`
with `web3formsKey` + `web3formsUrl` set and the scriptable fetch):

- **Fresh insert**: 200 `{ ok: true, id, status: "inserted" }` → exactly one
  POST to the web3forms URL with the lead body, and `audit_submitted`
  tracked (assert via the harness's track/beacon recording if it has one —
  read the harness first; if tracking is not observable through the harness,
  assert the web3forms POST count only and say so in NOTES).
- **Replay**: 200 `{ ok: true, id, status: "replay" }` → ZERO POSTs to the
  web3forms URL; still navigates to `/audit/thank-you` (assert the
  `location.assign` spy, following how existing tests assert navigation).

**Verify**: `node --test tests/audit-function.test.mjs && node --test tests/audit-retry.test.mjs` → all pass with the new tests.

## Test plan

- New tests per Step 3. Pattern: existing replay test at
  `tests/audit-function.test.mjs:649` ("replaying the same submission_id
  yields one row") and the retry-harness tests in `tests/audit-retry.test.mjs`.

## Done criteria

- [ ] `grep -n "status: persisted.status" functions/api/audit.ts` → present
- [ ] `grep -n "replay = body.status" src/scripts/audit.ts` → present (or equivalent)
- [ ] `grep -n "notifyWeb3Forms(payload)" src/scripts/audit.ts` shows it is gated by `!replay`
- [ ] `node --test tests/audit-function.test.mjs` passes
- [ ] `node --test tests/audit-retry.test.mjs` passes with the two new tests
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- The `AuditDeps`/`handleAuditRequest` shape differs from the excerpts.
- The audit-retry harness cannot observe fetch calls to the web3forms URL —
  read the harness first; if observation is impossible without a harness
  rewrite, report that instead of inventing a different mechanism.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The `status` field is additive — older deployed functions without it are
  treated as `inserted` by the client (safe default).
- If Web3Forms is ever replaced with a server-side notifier, the
  `status: "replay"` signal must be carried into that path too.
- Reviewer should scrutinize: the thank-you navigation must remain
  unconditional on replay; only `track` + `notifyWeb3Forms` are gated.
