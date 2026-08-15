# Noveno Launch — Operations Runbook

Operational procedures for the acquisition flow. Short, founder-sized,
single-operator. **Lead delivery is email-only via Web3Forms** — there is no
database, no lead table, and no backup to run.

## Lead pipeline (how the founder works leads)

1. Leads arrive as **Web3Forms email** to the founder inbox (the sole
   lead-delivery destination). Each email carries a `submission_id` —
   use it to recognize duplicate messages (e.g. a visitor retried after an
   ambiguous network failure). The email also carries attribution:
   `landing_page`, `referrer`, `utm_source/medium/campaign`, `first_seen_at`.
2. Work the lead from the inbox (no dashboard exists at launch by design).
   A `submission_id` seen twice means the same journey was delivered twice —
   treat the later message as a duplicate of the earlier one.

## Monitoring

- **Traffic/performance:** Cloudflare Web Analytics (page views + CWV).
- **Acquisition funnel:** `/api/events` → Analytics Engine dataset
  `noveno_events` (event names: `primary_cta_click`, `audit_started`,
  `audit_step_completed`, `audit_submitted`, `phone_click`,
  `messaging_click`, `service_opened`, `case_study_opened`,
  `project_opened`). Query via the Analytics Engine SQL API.
  Events carry **no PII** — funnel numbers only. `audit_submitted` fires
  only after Web3Forms confirms delivery, so it is a true conversion signal.
- **Failures:** Pages Functions logs. Expected codes: `validation` (400),
  `turnstile_failed` (403), `rate_limited` (429), `server_error` (500),
  `method_not_allowed` (405), `body_too_large` (413). Logs contain outcome
  codes + `submission_id` only — **never lead content**.

## Failure semantics (by design — do not "fix" silently)

| Failure | Visitor sees | Lead status | Action |
|---|---|---|---|
| `/api/audit` validation/abuse rejection | Field errors on the rejected fields + validation banner | Not delivered | Normal bot/traffic; no action |
| Turnstile reject/expire | «بررسی امنیتی ناموفق بود» + retry | Not delivered | Normal bot/token-lifetime traffic; no action |
| Web3Forms delivery fails (network/timeout/non-2xx/`success:false`/429) | Truthful «دریافت درخواست ناموفق بود» banner + retry + direct contact; values preserved; **no thank-you** | Not delivered | Check access key/inbox/rate limit; retry happens client-side |
| Analytics Engine down | Nothing | Delivered normally | Binding issue; check dataset exists |
| Visitor offline mid-form | Offline banner + contact fallback | Not delivered | Nothing; draft kept in their session |

Never present a false success: thank-you is reachable **only after
Web3Forms confirms acceptance**. Never change Web3Forms to another provider
without explicit approval. Never move delivery server-side (free-tier
constraint).

## Duplicate-submission note (accepted trade-off)

With no durable store, exactly-once delivery is impossible. A visitor who
retries after an ambiguous failure (Web3Forms accepted the first attempt but
the response was lost) can produce a second email with the same
`submission_id`. Deduplicate by eye in the inbox; do not rebuild a database
to solve this.

## Rollback

- **Site:** Cloudflare Pages → Deployments → roll back to the previous
  deployment (redeploy previous commit). The audit form is fully static;
  old deploys keep working.
- **Data:** none — lead data lives only in the founder inbox/email.

## Release checklist (per deploy)

1. `bash scripts/verify.sh` green locally.
2. Preview deploy → verify `/audit` journey + one real submission (email
   arrives) + one delivery-failure simulation (`web3forms-down` mode).
3. Promote preview to production.
4. Post-deploy smoke: `/audit` loads, widget renders, thank-you reachable
   after a real submission, email arrives, one event visible in
   `noveno_events`.

## Accepted residual risks (do not "fix" silently)

- **Client-side delivery is bypassable by design.** Web3Forms is a public
  client-side endpoint: anyone who reads the access key from the page HTML
  can POST directly to Web3Forms without the `/api/audit` anti-abuse stack
  (Turnstile/honeypot/rate limit). This is the accepted email-only
  architecture — server-side relay requires the Web3Forms paid plan + IP
  whitelisting. Mitigations: Web3Forms' own `botcheck` + access-key controls
  and founder-side inbox handling. Do not move delivery server-side without
  explicit approval and a paid plan.
- **Duplicate emails on ambiguous retry.** A visitor who retries after an
  ambiguous delivery failure can produce a second email with the same
  `submission_id` — deduplicate by eye in the inbox.

## Security notes (do not weaken)

- `TURNSTILE_SECRET_KEY` exists only as a Pages encrypted secret. It
  verifies tokens — never ship it to the browser, never paste it into logs,
  screenshots, or issues.
- The Web3Forms access key is **public by design** (client-side posting);
  abuse protection lives at the `/api/audit` boundary (honeypot, per-IP
  rate limiting, mandatory Turnstile siteverify). Do not remove the Turnstile
  check.
- The in-memory rate limiter is per-isolate (documented limitation);
  Turnstile is the primary abuse gate.
- The Web3Forms payload is HTML-stripped (free-text fields) and never
  contains the Turnstile token.
