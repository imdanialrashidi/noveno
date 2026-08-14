# Plan 014: Add a read-only leads funnel view (founder ops without a dashboard)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- supabase/migrations/ tests/supabase-contract.test.mjs docs/ops/runbook.md docs/ops/setup-checklist.md`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — additive migration only; the view is
  `security_invoker` so the zero-policies RLS posture is preserved
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

PRODUCT.md acceptance requires "every audit submission enters a reliable
lead system; lead source captured; clear owner/next action operationally".
Today that means the founder eyeballs the raw `leads` table in the Supabase
Table Editor (runbook "Lead pipeline"). A committed, read-only aggregate
view makes the weekly/monthly review (DNA §24) mechanical — without a web
dashboard, which the non-goals explicitly reject ("no custom CRM UI, client
portal, dashboard, auth" — launch plan §1). The schema already supports it
(`status`, `source`, `utm_source`, `submitted_at` all exist).

**Security-critical construction**: the view MUST be created with
`with (security_invoker = true)` so that RLS of the base table applies to
the querying role. Without it (pre-PG15 default), a view runs with its
owner's privileges — the table owner bypasses RLS — and the view would leak
all leads to any role that can select from it. Supabase is PG15+, so
`security_invoker` is available. With zero policies on `leads`, the view
returns nothing for anon/authenticated; only the founder (SQL editor,
postgres role) sees rows.

## Current state

- `supabase/migrations/20260811120000_leads.sql` — `public.leads` with
  `status text not null default 'new'`, `owner text`, `source text not null
  default 'website'`, `utm_source text`, `submitted_at timestamptz not null
  default now()`, RLS enabled with zero policies. Comment block says
  "Rollback = drop table / restore from backup".
- `tests/supabase-contract.test.mjs` — `readMigration()` (lines 22-27):
  ```js
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  assert.equal(files.length, 1, `expected exactly one launch migration, found: ${files.join(", ")}`);
  return fs.readFileSync(path.join(migrationsDir, files[0]), "utf8");
  ```
  **This assertion breaks when a second migration is added** — the test
  must be updated (Step 2). The other assertions (RLS, zero policies, no
  grants, row-shape drift vs `toLeadRow`, no secrets) run on the launch
  migration's text and must keep passing.
- `docs/ops/runbook.md` — "Lead pipeline" section: "Status values on the
  row: `new` (default) → update in place … No dashboard exists at launch by
  design; the table + email are the workflow." "Backups and restore"
  section: weekly export cadence.
- `docs/ops/setup-checklist.md` §1: "Open SQL Editor and run
  `supabase/migrations/20260811120000_leads.sql`."

## Repo conventions to match

- Migrations are additive-only; a schema rollback is not supported without
  data loss (runbook) — the new migration must not alter `leads`.
- Migration files carry a header comment (see the launch migration) and a
  timestamped name (`YYYYMMDDHHMMSS_slug.sql`), strictly greater than
  `20260811120000`.
- No grants to anon/authenticated, ever; no RLS policies without a
  deliberate security review (runbook "Security notes").

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Migration contract | `node --test tests/supabase-contract.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file supabase/migrations/20260813000000_leads_funnel_view.sql` | routes to the functions lane |

## Scope

**In scope** (the only files you should modify):
- `supabase/migrations/20260813000000_leads_funnel_view.sql` (create)
- `tests/supabase-contract.test.mjs`
- `docs/ops/runbook.md`
- `docs/ops/setup-checklist.md`

**Out of scope** (do NOT touch):
- `supabase/migrations/20260811120000_leads.sql` — the launch migration is
  the contract anchor; no edits.
- Any RLS policy, grant, or table change — the view is read-only and
  security_invoker.
- A web dashboard or any client-facing surface — explicitly rejected by
  non-goals; the founder queries via the SQL editor.

## Git workflow

- Branch: `improve/014-leads-funnel-view`
- Commit message style (match the repo): `feat(supabase): add read-only leads funnel view for founder ops`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the migration

Create `supabase/migrations/20260813000000_leads_funnel_view.sql`:

```sql
-- Noveno — read-only leads funnel summary for founder ops (plan DIR-04).
-- Additive-only: does not touch public.leads. No dashboard exists by
-- design (launch non-goals); the founder runs this view from the SQL
-- editor for the weekly/monthly review (docs/ops/runbook.md).
--
-- SECURITY: security_invoker = true — RLS of public.leads applies to the
-- querying role. With zero policies on leads the view yields nothing for
-- anon/authenticated; only the table owner (founder via the SQL editor)
-- sees rows. Never add grants to this view.

create view public.leads_funnel_summary
with (security_invoker = true) as
select
  date_trunc('week', submitted_at)::date as week,
  status,
  source,
  coalesce(utm_source, '(none)')         as utm_source,
  count(*)                                as leads
from public.leads
group by 1, 2, 3, 4;

comment on view public.leads_funnel_summary is
  'Weekly funnel summary by status/source/utm — founder ops only, read-only, security-invoker (RLS applies).';
```

**Verify**: file exists; `grep -n "security_invoker" supabase/migrations/20260813000000_leads_funnel_view.sql` → present.

### Step 2: Update the migration-contract test

In `tests/supabase-contract.test.mjs`, replace `readMigration()` so it
selects the launch migration by exact name instead of asserting exactly one
file:

```js
const LAUNCH_MIGRATION = "20260811120000_leads.sql";

function readMigration() {
  const launchPath = path.join(migrationsDir, LAUNCH_MIGRATION);
  assert.ok(
    fs.existsSync(launchPath),
    `launch migration ${LAUNCH_MIGRATION} missing; rename is a breaking change`,
  );
  return fs.readFileSync(launchPath, "utf8");
}
```

Update the file's header comment ("exactly one launch migration" → "the
launch migration by name; additional additive migrations are allowed").
Then add a test that extra migrations keep the security posture:

```js
test("additional migrations are additive and add no policies or grants", () => {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => f !== LAUNCH_MIGRATION);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    assert.doesNotMatch(sql, /create\s+policy/i, `${file}: no RLS policy may be added`);
    assert.doesNotMatch(sql, /grant[^;]*(anon|authenticated)[^;]*;/i, `${file}: no grants to anon/authenticated`);
    assert.doesNotMatch(sql, /\balter\s+table\b/i, `${file}: must not alter existing tables (additive-only)`);
    assert.match(sql, /security_invoker/i, `${file}: views over RLS tables must be security-invoker`);
  }
});
```

(Adjust the assertions to the live test file's style — match its
`assert.match`/`assert.doesNotMatch` usage.)

**Verify**: `node --test tests/supabase-contract.test.mjs` → all pass. Red-before-green: before this step, adding the migration file makes the old `files.length === 1` assertion fail — that is the demonstrated red.

### Step 3: Document founder usage

1. `docs/ops/runbook.md` — in "Lead pipeline", after the status-bullet, add:
   ```markdown
   - Weekly review: `select * from public.leads_funnel_summary order by week desc;`
     in the SQL editor — leads per week by status/source/utm (read-only
     view, security-invoker; see `supabase/migrations/20260813000000_leads_funnel_view.sql`).
   ```
2. `docs/ops/setup-checklist.md` §1 — after the launch-migration step, add:
   ```markdown
   2.5. Apply `supabase/migrations/20260813000000_leads_funnel_view.sql`
        (additive read-only view for founder weekly reviews).
   ```

**Verify**: `grep -n "leads_funnel_summary" docs/ops/runbook.md docs/ops/setup-checklist.md` → both present.

### Step 4: Verification

**Verify**: `node --test tests/supabase-contract.test.mjs` → pass;
`npm run check` → exit 0; `npm run build` → exit 0; `bash scripts/verify.sh` → exit 0.

## Test plan

- 1 updated helper + 1 new test in `tests/supabase-contract.test.mjs`
  (launch-migration-by-name; additive-migrations security posture).
- The row-shape drift test (persister ↔ migration columns) keeps guarding
  `leads` — the new view adds no columns to it.
- Live-SQL validation is founder-side (applied during provisioning per the
  setup-checklist update); the SQL is PG15-standard (`date_trunc`,
  `security_invoker` view option, `coalesce`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/supabase-contract.test.mjs` exits 0 with the new test
- [ ] `npm run check` exits 0; `npm run build` exits 0; `bash scripts/verify.sh` exits 0
- [ ] `grep -rn "create\s+policy\|grant.*anon\|grant.*authenticated\|alter table" supabase/migrations/20260813000000_leads_funnel_view.sql` → no matches
- [ ] `grep -n "security_invoker" supabase/migrations/20260813000000_leads_funnel_view.sql` → present
- [ ] `git status` shows no modification to `20260811120000_leads.sql`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The test file's structure differs from the excerpts (drift) — reconcile;
  if the drift is large, STOP.
- You find the live Supabase version does NOT support `security_invoker`
  views (PG < 15 — would make the view construction unsafe) — then STOP and
  report; do not fall back to a security-definer view.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a future dashboard IS wanted, it must add a narrowly scoped RLS
  policy + security review (runbook) — the funnel view's security_invoker
  construction means the view automatically respects whatever policies
  exist then. That is the designed evolution path.
- The weekly cadence matches DNA §24's monthly reporting offer — the view's
  `week` grouping supports both.
- If `leads` gains columns (e.g. `lost_reason` deferred at launch), extend
  the view's GROUP BY in a NEW additive migration — never edit the launch
  migration or this one in place after it is applied.
