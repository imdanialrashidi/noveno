# Spike — Attribution Aggregation View over Analytics Engine (D-04)

**Questions to answer**

- What is the cheapest read API for Analytics Engine (`wrangler analytics-engine sql` vs Cloudflare GraphQL API vs Dashboard)? Can it be run without prod binding (`NOVENO_EVENTS` provisioned per `docs/ops/setup-checklist.md:3.4`)?
- Cost of current write rate (`60/min/IP` per `functions/api/events.ts:179` + ~5 events/visitor funnel) at free tier?
- Should attribution (`landing_page`, `referrer`, `utm_*`) be enriched into event blobs so funnel can segment by channel without joining emails? Today `blobs[2]` only holds `page/section/step/service/slug/channel` — `landing_page` is email-only.
- Is durable store (KV/D1) needed for per-lead attribution, or email + weekly AE SQL enough for `docs/PLAN.md` stage 8 learning loop?
- Minimal useful aggregation: daily counts for `primary_cta_click → audit_started → audit_step_completed(by step) → audit_submitted` segmented by `service`/`channel`?

## Current write schema

From `functions/api/events.ts:195`:

```
indexes: [event.name]
doubles: [Date.now()]
blobs: [page, section, JSON.stringify(payload)]  // payload ⊆ EVENT_PAYLOAD_KEYS = page, section, cta_id, step, service, slug, channel
```

`NOVENO_EVENTS` has no attribution columns — channel/UTM segmentation must come from enriching `payload` or joining inbox. PII-free (`functions/lib/contract.ts:40-60`).

## Read shape

```sql
SELECT index1 AS event, COUNT(*) AS n
FROM noveno_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY index1 ORDER BY n DESC;

-- step breakdown
SELECT JSON_EXTRACT(blobs[3], '$.step') AS step, COUNT(*) AS n
FROM noveno_events WHERE index1 = 'audit_step_completed'
GROUP BY step ORDER BY step;

-- service/channel
SELECT JSON_EXTRACT(blobs[3], '$.service') AS service, COUNT(*) FROM noveno_events WHERE index1='audit_submitted' GROUP BY service;
```

In Analytics Engine SQL, `doubles` map to `timestamp`, `indexes` to `index1`, `blobs` to `blob1..3` (check https://developers.cloudflare.com/analytics/analytics-engine/sql-api/ — 2026-08).

## Cost & risk

- Analytics Engine free: 25M writes/mo (Cloudflare docs 2024, verify via https://developers.cloudflare.com/analytics/analytics-engine/ — record date).
- Current funnel ~5 events/visitor, `60/min/IP` per-isolate + plan 022 `origin/referer` guard mitigates distributed quota burn.
- No PII in `indexes/blobs` — reader must not log `phone`/`email` (contract enforces).

## Recommendation

**A — Keep email + weekly AE SQL** (cheapest, no new binding). Founder runs `node scripts/query-events.mjs --range 7` weekly, pastes funnel into evidence ledger. No new plan unless volume warrants.

- **B — Enrich events with attribution** would add `utm_source`/`landing_page` to `track("audit_submitted", { service, utm_source })` — requires `EVENT_PAYLOAD_KEYS` + `EVENT_VALUE_PATTERNS.page` update (plan 022 gates) and low PII risk, but not needed until channel segmentation proven via email scan.
- **C — Minimal /admin reader** (`GET /api/events/summary` behind CF Access/basic-auth) returns 7d funnel — needs `risk-review` for auth; deferred until `N/week > threshold` in `docs/PLAN.md` stage 6.

**Verdict:** **A** now; revisit B when email shows channel variance, C only after launch data proves weekly SQL is too manual. Next step: keep `scripts/query-events.mjs` as founder tool; open plan 032 only if B approved.

**Not worth building threshold:** if `audit_submitted` < 5/week for 30 days, weekly SQL is overkill — check evidence ledger.

**Prototype:** `scripts/query-events.mjs` runnable without creds (prints “would query”), with `CF_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` hits AE SQL API (see script).

**Verification:** `node scripts/query-events.mjs --range 7` exits 0 without creds; `npm test` green; `wrangler.jsonc` still 1 `NOVENO_EVENTS` binding.
