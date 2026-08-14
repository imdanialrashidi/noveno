# Plan 018: Remove the dead `submittedAt` parameter and `now` dependency

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
> treat it as a STOP condition. NOTE: plans 004 and 008 touch
> `functions/api/audit.ts` — reconcile the excerpts with the live file
> (the `toLeadRow`/`AuditDeps` parts below should be unchanged by them).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

`toLeadRow(submission, submittedAt)` accepts a `submittedAt` argument it
never uses — the returned `LeadRow` has no `submitted_at` field
(`functions/api/audit.ts:32`), and the DB default `now()` on the column is
authoritative (migration `20260811120000_leads.sql`:
`submitted_at timestamptz not null default now()`). The `AuditDeps.now`
dependency exists only to feed this dead parameter
(`handleAuditRequest` line 114 computes it, line 116 passes it). The
behavior is correct today and pinned by `tests/audit-function.test.mjs:586`
(`row.submitted_at === undefined`), but the dead seam is misleading: anyone
wiring `submitted_at` later changes replay semantics (a retried submission
would update the timestamp — arguably wrong) without noticing the test pins
the current behavior. Removing the dead code makes the intent explicit:
the DB owns the timestamp, the client never controls it.

## Current state

`functions/api/audit.ts`:

```ts
export interface AuditDeps {
  verifyTurnstile: (submission: AuditSubmission, ip: string) => Promise<TurnstileOutcome>;
  persistLead: (row: LeadRow) => Promise<{ status: "inserted" | "replay"; id: string }>;
  rateLimiter: RateLimiter;
  now?: () => string;
}

/** Map a validated submission to the persistence row (leads table shape). */
export function toLeadRow(submission: AuditSubmission, submittedAt: string): LeadRow {
  // ... builds the row from submission fields; submittedAt is never used.
}
```

and in `handleAuditRequest` (lines ~113-116):

```ts
  const submittedAt = deps.now?.() ?? new Date().toISOString();
  try {
    const persisted = await deps.persistLead(toLeadRow(submission, submittedAt));
```

`tests/audit-function.test.mjs:112` passes `now: () => "2026-08-11T12:00:00.000Z"` in a deps fixture; line ~586 asserts `row.submitted_at === undefined`.

## Repo conventions to match

- Remove dead seams completely (no commented-out code); update the
  affected test fixtures in the same change.
- `AuditDeps` stays explicit-dependency style — only the dead member goes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `functions/api/audit.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `supabase/migrations/20260811120000_leads.sql` — the column and its
  default stay; no schema change (a comment is unnecessary; the runbook
  documents the lead model).
- `functions/lib/persist.ts` — the `LeadRow` type stays without
  `submitted_at` (DB-managed, as the supabase-contract test asserts).
- Any client code.

## Git workflow

- Branch: `improve/018-toleadrow-dead-param`
- Commit message style (match the repo): `refactor(functions): drop the unused submittedAt param and now dep (DB default owns the timestamp)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the parameter and the dependency

In `functions/api/audit.ts`:

1. `AuditDeps`: delete the `now?: () => string;` member.
2. `toLeadRow(submission, submittedAt)`: change the signature to
   `toLeadRow(submission: AuditSubmission): LeadRow` and delete the unused
   parameter (the body is unchanged).
3. In `handleAuditRequest`, delete the `submittedAt` line and change the
   call to `toLeadRow(submission)`.
4. Update the doc comment on `toLeadRow` if it mentions the parameter, and
   add one line noting `submitted_at` is DB-managed by design (column
   default `now()`; replay keeps the original timestamp).

**Verify**: `npm run check` exits 0 (the type error from the removed param
would surface here); `grep -n "submittedAt\|deps.now" functions/api/audit.ts` → no matches.

### Step 2: Update the test fixtures

In `tests/audit-function.test.mjs`:

1. Delete the `now: () => "2026-08-11T12:00:00.000Z"` line from the deps
   fixture (~line 112).
2. The `row.submitted_at === undefined` assertion (~line 586) stays as is —
   it now documents the intent ("column default, not client-controlled").
3. If any test calls `toLeadRow(payload, something)` directly, drop the
   second argument.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass.

## Test plan

- No new tests: the existing suite pins the behavior (`submitted_at ===
  undefined` in the row; all request-level invariants unchanged). The
  change is type-level and compile-checked.
- Grep guards: `grep -rn "submittedAt" functions/ tests/` → no matches
  after the change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `node --test tests/audit-function.test.mjs` exits 0
- [ ] `grep -rn "submittedAt\|deps.now\|now: () =>" functions/api/audit.ts tests/audit-function.test.mjs` → no matches
- [ ] `grep -n "submitted_at timestamptz not null default now()" supabase/migrations/20260811120000_leads.sql` → still present (schema untouched)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (plans 004/008 may have touched the file — if `toLeadRow`/`AuditDeps`
  themselves drifted, reconcile; large drift → STOP).
- A test fails after the change in a way that suggests `submitted_at`
  IS expected somewhere (then the excerpt's premise was wrong — report).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a future feature needs a client-visible submission time, the correct
  change is to READ the DB-managed `submitted_at` back (the persist step
  already re-selects on replay) — never to write it from the client.
- The supabase-contract test's `dbManaged` set (`id`, `created_at`,
  `submitted_at`, `status`, `owner`) already encodes this intent — keep it
  when the row shape evolves.
- Plan 008's `buildAuditDeps` must NOT re-add a `now` dependency; this
  plan and plan 008 both touch `AuditDeps` — if 008 landed first, its
  factory simply has no `now` to wire (it never had one).
