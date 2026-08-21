# Plan 031: Spike — attribution aggregation view over Analytics Engine (D-04)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- functions/api/events.ts src/scripts/analytics.ts wrangler.jsonc docs/PLAN.md docs/PRODUCT.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (spike: 1-2 days — query shape + cost + mock reader; no prod /admin yet)
- **Risk**: LOW
- **Depends on**: 022 (events hardening — quota story informed by this spike); run 022 before or in parallel
- **Category**: direction / spike
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

Acquisition telemetry exists but has no viewer. `functions/api/events.ts` writes `audit_started / audit_step_completed / audit_submitted / phone_click / messaging_click` with `page/section/step/service/slug/channel` into `NOVENO_EVENTS` (Analytics Engine), while attribution (`landing_page`, `referrer`, `utm_*`, `first_seen_at`) rides only in the Web3Forms email (`src/scripts/analytics.ts: captureAttribution` → `src/scripts/audit.ts: buildWeb3FormsBody`). The founder must scan emails to see "which channel brings qualified audits" — the funnel `visitors → CTA → audit start → submission → qualified lead` from `docs/PRODUCT.md: Must-have user flows` is not aggregated anywhere. Analytics Engine already collects the first half (events), but no one can query it without a reader. This spike defines the cheapest read path (SQL API vs. scheduled email summary) and whether a durable store (KV/D1) is worth it — without building a dashboard prematurely (`docs/PLAN.md: stage 8 learning loop`).

## Current state

Relevant files:
- `functions/api/events.ts` — writes `dataset.writeDataPoint({ indexes:[event.name], doubles:[Date.now()], blobs:[page, section, JSON.stringify(payload)] })` at `:195`
- `src/scripts/analytics.ts` — `captureAttribution` (first page wins via `sessionStorage noveno:attribution`), `track(name,payload)` queue → `sendBeacon`/`fetch keepalive` to `/api/events`, `initAnalytics` declarative `data-event`
- `wrangler.jsonc` — `analytics_engine_datasets: [{ binding:"NOVENO_EVENTS", dataset:"noveno_events" }]`
- `docs/PRODUCT.md: Must-have user flows` — funnel definition; `docs/PLAN.md: 8. Learning loop` — monthly review
- `docs/ARCHITECTURE.md` — analytics is Web Analytics + Analytics Engine via `functions/api/events.ts`; attic: "`Zaraz deferred` — tag manager, not a store"

Excerpt — `functions/api/events.ts:188-205` (write path):

```ts
  dataset.writeDataPoint({
    indexes: [event.name],
    doubles: [Date.now()],
    blobs: [page, section, JSON.stringify(event.payload)],
  });
```

Excerpt — `src/scripts/analytics.ts:40-65` (attribution capture, first page wins):

```ts
const ATTRIBUTION_KEY = "noveno:attribution";
export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const params = new URLSearchParams(location.search);
    const attribution: Attribution = {
      landing_page: location.pathname + location.search,
      referrer: document.referrer,
      first_seen_at: new Date().toISOString(),
    };
    for (const key of UTM_KEYS) { const value = params.get(key); if (value) attribution[key]=value; }
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {}
}
```

Repo conventions:
- Data stores: **none** (`docs/ARCHITECTURE.md: Data stores: none` — 2026-10 email-only). Adding KV/D1 is an explicit decision, not a side effect.
- Spikes produce a decision doc under `docs/exec-plans/active/` with provider/cost/API shape and a tiny prototype under `research/` or `scripts/` — per `improve` skill direction guidance, not a full build-everything plan.
- Analytics payloads are `EVENT_PAYLOAD_KEYS = page, section, cta_id, step, service, slug, channel` (PII-free) at `functions/lib/contract.ts:43-50`; attribution is richer but lives in the email, not in Analytics Engine blobs today.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | 19 pages |
| AE query (spike) | `npx wrangler analytics-engine sql --dataset=noveno_events --query="SELECT …"` | requires Cloudflare auth (record whether available) |
| Local preview | `npx wrangler pages dev dist` | local AE is 501-degraded (expected) — see `functions/api/events.ts:165` |

## Scope

**In scope** (only files you should produce/modify for the spike):
- `docs/exec-plans/active/attribution-aggregation-spike.md` (create) — decision doc: query shapes, cost, read API choice, whether to enrich events with attribution, and whether KV/D1 is needed
- `scripts/query-events.mjs` (create) or `research/attribution-reader/` — tiny Node script that queries `noveno_events` via Analytics Engine SQL API (uses `CLOUDFLARE_API_TOKEN` / `CF_ACCOUNT_ID` from env, never committed) and prints funnel summary (CTA clicks → starts → step completions → submissions) for the last 7/30 days
- `docs/PRODUCT.md` or `docs/PLAN.md` — no change except a one-line "spike evaluated" note if the spike concludes "not worth building"

**Out of scope** (do NOT do in this spike):
- Building `/admin` dashboard or any auth/tenancy (high-risk — needs `risk-review`)
- Adding a KV/D1 lead store (evaluate, don't implement)
- Changing `functions/api/events.ts` write schema (evaluate enrichment, don't mutate `indexes/blobs` yet)
- Adding Zaraz or a third-party analytics vendor

## Git workflow

- Branch: `advisor/031-attribution-aggregation-spike`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed; spike stays on branch

## Steps

### Step 1: Write the spike decision doc (questions, not code)

Create `docs/exec-plans/active/attribution-aggregation-spike.md` with five sections:

1. **Questions to answer**:
   - What is the cheapest read API for Analytics Engine (`wrangler analytics-engine sql` vs. Cloudflare GraphQL API vs. Dashboard)? Can it be run without a prod account (or only after `NOVENO_EVENTS` binding is provisioned per `docs/ops/setup-checklist.md:3.4`)?
   - What is the cost of the current write rate (`60/min/IP` per `functions/api/events.ts:179` + real funnel ~5 events per visitor) at free tier?
   - Should attribution (`landing_page`, `referrer`, `utm_source/medium/campaign`) be enriched into `events` blobs so the funnel can segment by channel without joining emails? (Today only `page/section/step/service/slug/channel` are in `blobs[2]` — `landing_page` is email-only.)
   - Is a durable store (KV/D1/Counter) needed for per-lead attribution, or is email + weekly AE SQL enough for the `docs/PLAN.md: stage 8` learning loop?
   - What is the minimal useful aggregation: daily counts for `primary_cta_click` → `audit_started` → `audit_step_completed` (by `step`) → `audit_submitted`, segmented by `service`/`channel`?

2. **Current write schema** (from `functions/api/events.ts:195`):
   ```
   indexes: [event.name]
   doubles: [Date.now()]
   blobs: [page, section, JSON.stringify(payload)]  // payload ⊆ EVENT_PAYLOAD_KEYS
   ```
   Note that `NOVENO_EVENTS` today has no attribution columns — any channel/UTM segmentation must come from either enriching `payload` or joining with the email inbox.

3. **Read shape** (spike prototype, not prod):
   ```sql
   SELECT index1 AS event, COUNT(*) AS n
   FROM noveno_events
   WHERE timestamp > NOW() - INTERVAL '30' DAY
   GROUP BY index1 ORDER BY n DESC;
   -- plus: blobs[3] JSON payload parsing for step/service/channel breakdown
   ```

4. **Cost & risk**:
   - Analytics Engine free tier: 25M writes/month (check current via `web_fetch` Cloudflare docs — record URL/date).
   - `/api/events` `60/min/IP` limiter (`functions/lib/rate-limit.ts`) is per-isolate (finding 03/plan 022) — distributed quota burn is mitigated by plan 022's no-Origin guard.
   - No PII in `indexes/blobs` (contract at `functions/lib/contract.ts:40-60`) — spike reader must not log lead PII.

5. **Recommendation** (one of three):
   - **A — Keep email + weekly AE SQL**: founder runs `scripts/query-events.mjs --range 7d` weekly, pastes funnel into `docs/PLAN.md` evidence ledger. Cheapest, no new binding.
   - **B — Enrich events with attribution**: add `landing_page`/`utm_source` to `track("audit_submitted", { page, service, source: attribution.utm_source })` so SQL can segment `audit_submitted` by `utm_source` without email joins.
   - **C — Add a minimal /admin reader** (future build-everything plan): Pages Function `GET /api/events/summary` behind `CF_ACCESS` or basic-auth, returns pre-aggregated funnel for last 7d. Requires auth threat model (`risk-review`).

**Verify**: `npm run check` → exit 0 (markdown only)

### Step 2: Prototype the cheapest reader (no new binding, no dashboard)

Create `scripts/query-events.mjs`:

```mjs
#!/usr/bin/env node
// Tiny Analytics Engine reader — spike prototype, not a product dependency.
// Reads CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID from env (never committed).
// Usage: CF_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/query-events.mjs --range 7
import { writeFileSync } from "node:fs";
const range = process.argv.includes("--range") ? process.argv[process.argv.indexOf("--range")+1] : "7";
console.log(`[spike] would query noveno_events last ${range}d: COUNT by event, by step/service/channel`);
console.log("[spike] not querying without credentials — run with CF_ACCOUNT_ID + CLOUDFLARE_API_TOKEN to hit Analytics Engine SQL API");
// If creds present, fetch("https://api.cloudflare.com/client/v4/accounts/{id}/analytics_engine/sql", { method:"POST", headers:{Authorization:`Bearer ${token}`}, body: JSON.stringify({query:"SELECT ..."}) })
```

Keep the prototype runnable without credentials (prints "would query") so `npm test` / CI don't need Cloudflare auth. When credentials are present, it should print a small funnel table (event → count) for manual review.

Alternatively, a `research/attribution-reader/README.md` with the SQL queries and a `curl` example is acceptable — the artifact is the query shape, not the runner.

**Verify**: `node scripts/query-events.mjs --range 7` → prints spike message (no creds needed); `CLOUDFLARE_API_TOKEN=dummy CF_ACCOUNT_ID=dummy node scripts/query-events.mjs` → still prints (doesn't actually fetch without real token — don't commit token)

### Step 3: Evaluate attribution enrichment (decision, not mutation)

In the spike doc, answer: should `src/scripts/analytics.ts: track("audit_submitted", { service, step })` also send `utm_source` / `landing_page` so the `audit_submitted` event can segment by acquisition channel without the email?

- If **yes**, note the required change: `functions/lib/contract.ts: EVENT_PAYLOAD_KEYS` already allows `page/section/step/service/slug/channel` — `utm_source` would need a new key (e.g., `utm_source`) or be nested in `blobs[2]` JSON payload (already `JSON.stringify(payload)` — just add the key). Document that `EVENT_PAYLOAD_KEYS` + `EVENT_VALUE_PATTERNS` must be updated (plan 022 pattern gates), and that `analogous` PII risk is low (`utm_source` is not PII).
- If **no**, document that channel segmentation stays email-only and the SQL reader can only count `audit_submitted` totals, not by source — still useful for funnel shape.

Do NOT change `functions/api/events.ts` write schema in this spike — only document the trade-off.

**Verify**: `npm run check` → exit 0

### Step 4: Close the spike with a recommendation

Append to `docs/exec-plans/active/attribution-aggregation-spike.md`:

- **Verdict**: A/B/C with one-paragraph rationale (cost, effort, learning-loop value per `docs/PRODUCT.md: risks`).
- **Next step**: if A → keep `scripts/query-events.mjs` as founder tool, no new plan. If B → open plan `032` (enrich events, S). If C → open plan `033` (admin reader, M, needs `risk-review` for auth).
- **Not worth building** threshold: if `audit_submitted` < N/week for 30 days, weekly SQL is overkill — check `docs/PLAN.md` evidence ledger after launch (stage 6) before building C.

**Verify**: `bash scripts/project-verify.sh` (if exists) → no failures

## Test plan

- Spike is doc + prototype, not a behavioral change — no new `node:test` required. Verification is that existing tests still pass and the prototype runs without credentials:
  - `node scripts/query-events.mjs --range 7` → prints funnel header, exit 0
  - `npm test` → all pass (no regression)
- Optional pin: extend `tests/audit-function.test.mjs` with no new case; or add `tests/analytics-aggregation.test.mjs` that asserts the spike doc exists (`fs.existsSync("docs/exec-plans/active/attribution-aggregation-spike.md")`) — trivial but proves artifact.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `docs/exec-plans/active/attribution-aggregation-spike.md` exists with ≥4 sections (questions, schema, read shape, cost, recommendation)
- [ ] `scripts/query-events.mjs` exists and `node scripts/query-events.mjs --range 7` exits 0 without needing Cloudflare credentials
- [ ] No new Cloudflare binding added to `wrangler.jsonc` (`grep -c NOVENO_EVENTS wrangler.jsonc` still 1)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- Analytics Engine SQL API is not available without a paid plan or the dataset `noveno_events` is not queryable until after first write (spike can't validate read shape) — document as open question with "requires first prod write to validate query"
- Enriching `audit_submitted` with `utm_source` would violate a PII or funnel invariant (e.g., `utm_source` contains free-form values that bypass `EVENT_VALUE_PATTERNS` — plan 022 gates it; spike must note the pattern update needed)
- Building even the spike reader requires storing lead PII (it must not — `blobs` are PII-free; if someone proposes storing `phone`/`email`, stop)
- The spike concludes that a dashboard is needed before launch data exists (launch is the experiment per `docs/PLAN.md: 2. Walking skeleton` — bias to A, not C, until funnel volume is known)

## Maintenance notes

- Reviewer should check that the spike doc's SQL `timestamp` window uses Analytics Engine's `timestamp` alias (not `doubles`) — `writeDataPoint({ doubles:[Date.now()], … })` maps to `timestamp` in SQL; verify via Cloudflare docs at spike time.
- If plan 022 (events hardening) lands, its `referer` fallback and per-isolate limiter note should be referenced in this doc's cost section.
- Future: if `D-01` (server-side email) lands, attribution could be written server-side into the email *and* into `NOVENO_EVENTS` in one place — the enrichment decision (B) should be revisited then.
