# Plan 011: Add the Analytics Engine query reference for the acquisition funnel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- docs/ops/runbook.md docs/ops/analytics-queries.md functions/api/events.ts`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (do NOT depend on plan 013 — write the doc so the
  UTM queries are marked "after plan 013 lands")
- **Category**: direction
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The acquisition funnel is fully instrumented — `audit_started`,
`audit_step_completed`, `audit_submitted`, `primary_cta_click`,
`phone_click`, `messaging_click`, `service_opened`, `case_study_opened`,
`project_opened` are written to the Analytics Engine dataset `noveno_events`
— but the founder cannot read any of it: `docs/ops/runbook.md` "Monitoring"
says only "Query via the Analytics Engine SQL API" with zero queries. The
riskiest product assumption (PRODUCT.md: an SMB owner completes the
multi-step form) and the 30-day conversion check (PLAN.md risk table)
depend on step-level drop-off that is measured but not queryable without
hand-writing Analytics Engine SQL against the recorded blob layout. This
plan delivers the query reference document; the queries are marked
provisional until validated on the live dataset (writes are UNPROVEN until
the binding exists post-deploy).

## Current state

- `docs/ops/runbook.md` "Monitoring" section (lines ~17-26): lists event
  names, then `Query via the Analytics Engine SQL API.` — nothing more.
- `functions/api/events.ts` datapoint shape (lines ~104-113):
  `dataset.writeDataPoint({ indexes: [event.name], doubles: [Date.now()],
  blobs: [page, section, JSON.stringify(event.payload)] })` — so in the
  dataset: `indexes[0]` = event name, `doubles[0]` = epoch millis,
  `blobs[0]` = page, `blobs[1]` = section, `blobs[2]` = full payload JSON
  (keys: page, section, cta_id, step, service, slug, channel — whitelisted
  in `functions/lib/contract.ts` EVENT_PAYLOAD_KEYS).
- Dataset binding name: `NOVENO_EVENTS` → dataset `noveno_events`
  (setup-checklist.md §4.4, wrangler.jsonc).
- Event payload values: `step` carries the journey step number for
  `audit_step_completed` (string, e.g. "2"); `section` carries the CTA
  placement for click events.

## Repo conventions to match

- `docs/ops/*` docs are founder-sized, short, single-operator (see runbook
  tone). Persian labels where helpful, English technical identifiers.
- Mark external-UNPROVEN things explicitly (the launch plan's UNPROVEN
  convention) — the queries cannot be validated until the binding is
  deployed; say so in the doc.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Doc consistency grep | `grep -rn "audit_started\|audit_step_completed\|audit_submitted" docs/ops/analytics-queries.md` | all three present in queries |
| Full gate | `bash scripts/verify.sh` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file docs/ops/runbook.md` | routes to workflow-contract lane |

## Scope

**In scope** (the only files you should modify):
- `docs/ops/analytics-queries.md` (create)
- `docs/ops/runbook.md` (Monitoring section: link to the new doc)

**Out of scope** (do NOT touch):
- `functions/api/events.ts` — no schema change here (plan 013 adds UTM keys
  to payloads; the doc references it as a future section).
- Any SQL execution tooling or dashboards — doc-only by design (no
  dashboard non-goal).

## Git workflow

- Branch: `improve/011-analytics-queries`
- Commit message style (match the repo): `docs(ops): add Analytics Engine query reference for the acquisition funnel`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write `docs/ops/analytics-queries.md`

Structure (match the runbook's short section style):

1. **Dataset layout** — the `noveno_events` mapping table
   (indexes/doubles/blobs as above), the event-name list, and the
   no-PII statement.
2. **How to run** — Analytics Engine SQL API (dashboard → Analytics →
   Analytics Engine → Query, or the SQL API), and the note that AE SQL
   requires the `SAMPLE` clause on aggregations (confirm the exact clause
   syntax against the live dashboard when validating — the dialect details
   below are provisional).
3. **Queries** (4-5, each with: what it answers, the SQL, the expected
   shape):
   - Funnel totals: daily `audit_started` vs `audit_submitted` counts
     (completion-rate numerator/denominator).
   - Step drop-off: `audit_step_completed` grouped by the `step` value from
     `blobs[2]` (payload JSON) — find where the funnel leaks.
   - CTA clicks by section: `primary_cta_click` grouped by `section`
     (payload key in `blobs[2]`).
   - Contact clicks: `phone_click` + `messaging_click` totals (contact
     redundancy health).
   - Channel reach (marked "after plan 013 lands"): `audit_started` grouped
     by `utm_source` from the payload — include the query skeleton now with
     an explicit note that the key is not yet written by the client.
4. **Validation note** — the whole reference is provisional until the
   preview-deploy smoke (runbook release checklist step 4) confirms events
   land; record the exact validated query text then.
5. **Monthly cadence** — point at the DNA §24 monthly reporting offer:
   run the funnel-totals + drop-off queries at each monthly review.

Write the SQL in a dialect-neutral-ish form (standard SQL with AE
specifics called out): e.g.

```sql
-- Completion rate: how many journeys that started also submitted?
SELECT
  day,
  countIf(name = 'audit_started')  AS started,
  countIf(name = 'audit_submitted') AS submitted
FROM noveno_events
WHERE name IN ('audit_started', 'audit_submitted')
  AND timestamp >= now() - INTERVAL '30 days'
GROUP BY day
ORDER BY day
SAMPLE 1.0
```

(for each query, keep the `SAMPLE` line and a comment that the clause is
required by Analytics Engine; adjust to the exact dialect on validation).

**Verify**: the doc exists and contains all three funnel event names in
query context; `bash scripts/verify.sh` exits 0.

### Step 2: Link it from the runbook

In `docs/ops/runbook.md`, replace the bare `Query via the Analytics Engine
SQL API.` line with:

```markdown
Query via the Analytics Engine SQL API — ready-made queries (funnel
totals, step drop-off, CTA clicks): see `docs/ops/analytics-queries.md`
(provisional until the post-deploy smoke validates them).
```

**Verify**: `grep -n "analytics-queries" docs/ops/runbook.md` → the link
line present; `bash scripts/verify.sh` exits 0.

## Test plan

- Doc-only: no tests. Verification is the grep assertions above plus the
  full gate.
- Consistency guard: the event names in the doc must match
  `functions/lib/contract.ts` EVENT_NAMES exactly (re-check when either
  changes — add that to the maintenance notes).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `docs/ops/analytics-queries.md` exists with the dataset-layout table, ≥4 queries, the SAMPLE note, and the plan-013 channel-query section marked provisional
- [ ] `grep -n "analytics-queries" docs/ops/runbook.md` → link present
- [ ] `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The event names or blob layout in `functions/api/events.ts` differ from
  the "Current state" excerpts (drift) — reconcile the doc to the code.
- You cannot determine the AE SQL dialect details (SAMPLE clause etc.) with
  confidence — that is fine: the doc is explicitly provisional; do NOT
  block on it. Only STOP if the code layout itself contradicts the doc.

## Maintenance notes

- Plan 013 adds UTM keys to event payloads: when it lands, update the
  "Channel reach" query section from provisional to current.
- If a new event name is added to EVENT_NAMES, add its query section here
  (or at least the funnel reference) in the same change.
- The post-deploy smoke (runbook release checklist step 4) is the moment
  the provisional markers get removed — a reviewer should check the doc's
  validation note is updated after the first production event lands.
