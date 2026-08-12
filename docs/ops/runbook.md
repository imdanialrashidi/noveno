# Noveno Launch — Operations Runbook (Slice 2)

Operational procedures for the acquisition flow. Short, founder-sized,
single-operator. Supabase is the source of truth; everything else is
convenience.

## Lead pipeline (how the founder works leads)

1. Leads arrive in **Supabase → Table Editor → `leads`** (source of truth)
   and as a **Web3Forms email** (convenience copy).
2. Status values on the row: `new` (default) → update in place as work
   progresses (e.g. `contacted`, `qualified`…). No dashboard exists at
   launch by design; the table + email are the workflow.
3. Attribution rides on the row: `landing_page`, `referrer`, `utm_*`,
   `first_seen_at`, `submitted_at` — use it to judge channel quality.

## Monitoring

- **Traffic/performance:** Cloudflare Web Analytics (page views + CWV).
- **Acquisition funnel:** `/api/events` → Analytics Engine dataset
  `noveno_events` (event names: `primary_cta_click`, `audit_started`,
  `audit_step_completed`, `audit_submitted`, `phone_click`,
  `messaging_click`, `service_opened`, `case_study_opened`,
  `project_opened`). Query via the Analytics Engine SQL API.
  Events carry **no PII** — funnel numbers only.
- **Failures:** Pages Functions logs. Expected codes: `validation` (400),
  `turnstile_failed` (403), `rate_limited` (429), `persistence_failed`
  (502), `server_error` (500), `method_not_allowed` (405),
  `body_too_large` (413). Logs contain outcome codes + `submission_id`
  only — **never lead content**.
- Watch for a rising `persistence_failed` rate → Supabase is down or the
  service-role key rotated → check immediately, leads are being lost.

## Failure semantics (by design — do not "fix" silently)

| Failure | Visitor sees | Lead status | Action |
|---|---|---|---|
| Supabase insert fails | Retry banner (502), values kept | Not persisted | Check Supabase status/key; redeploy if config broke |
| Turnstile reject/expire | «بررسی امنیتی ناموفق بود» + retry | Not persisted | Normal bot/token-lifetime traffic; no action |
| Web3Forms email fails | Nothing (still thank-you) | **Persisted, safe** | Check access key/spam; lead is in Supabase |
| Analytics Engine down | Nothing | Persisted normally | Binding issue; check dataset exists |
| Visitor offline mid-form | Offline banner + contact fallback | Not submitted | Nothing; draft kept in their session |

Never change Web3Forms to another provider without explicit approval (plan
R1). Never move the notification server-side (free-tier constraint).

## Backups and restore

- **Before launch:** take a Supabase backup (Dashboard → Database → Backups
  or `supabase db dump`).
- **Cadence:** weekly export of `leads` (or enable the free daily backup if
  available in the plan).
- **Restore drill:** restoring the `leads` table is the recovery path for
  accidental deletion. Test once before launch.

## Rollback

- **Site:** Cloudflare Pages → Deployments → roll back to the previous
  deployment (redeploy previous commit). The audit form is fully static;
  old deploys keep working.
- **Schema:** the launch migration is additive-only. A schema rollback is
  **not** supported without data loss; instead apply a new additive
  migration. The unique `submission_id` constraint must never be dropped.

## Release checklist (per deploy)

1. `bash scripts/verify.sh` green locally.
2. Preview deploy → verify `/audit` journey + one real submission + one
   duplicate-replay attempt (single row).
3. Promote preview to production.
4. Post-deploy smoke: `/audit` loads, widget renders, thank-you reachable
   after a real submission, email arrives, one event visible in
   `noveno_events`.

## Security notes (do not weaken)

- `SUPABASE_SERVICE_ROLE_KEY` and `TURNSTILE_SECRET_KEY` exist only as
  Pages encrypted secrets. They bypass RLS / verify tokens — never ship
  them to the browser, never paste them into logs, screenshots, or issues.
- `leads` has RLS enabled with zero policies: there is no public lead-read
  path. If a future dashboard needs reads, add a narrowly scoped RLS
  policy + review — never open the table.
- The in-memory rate limiter is per-isolate (documented limitation);
  Turnstile is the primary abuse gate. Do not remove the Turnstile check.
