# Plan 013: Attach the channel dimension (UTM) to the audit funnel events

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- functions/lib/contract.ts src/scripts/audit.ts src/scripts/analytics.ts tests/audit-function.test.mjs tests/audit-retry.test.mjs`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (payload-policy change on a metered path; campaign
  strings are not PII but must stay out of lead/log paths — the invariant
  is already respected, keep it so)
- **Depends on**: plans/002-events-same-origin-gate.md (events-path changes
  land in review order; also plan 011's doc references this plan's key)
- **Category**: direction
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

The funnel's top is channel-blind. Verified facts: Cloudflare Web Analytics
does NOT log UTM params (launch plan §3); the event payload whitelist
(`functions/lib/contract.ts` EVENT_PAYLOAD_KEYS) has no UTM keys; the
client already captures `utm_*` on the first page into sessionStorage
(`src/scripts/analytics.ts` `captureAttribution`, key `noveno:attribution`)
but never sends it to `/api/events`. Consequence: the founder cannot see
WHICH channel reaches the funnel (Instagram vs Google vs referral) until —
and unless — a full lead converts (UTM rides the lead row). That is the
core of the product thesis ("trackable path from attention to action",
PRODUCT.md), and the guardrail metric "lead source visibility" needs it.
This plan sends `utm_source`/`utm_medium`/`utm_campaign` with
`audit_started` (and keeps them out of every other event — data
minimization).

## Current state

- `functions/lib/contract.ts:82-87`:
  ```ts
  export const EVENT_PAYLOAD_KEYS = [
    "page", "section", "cta_id", "step", "service", "slug", "channel",
  ] as const;
  ```
  and `LIMITS.maxEventPayloadValue: 100` (line ~113), `maxEventPayloadBytes: 1024`.
- `functions/api/events.ts` `validateEvent`: payload keys must be in
  EVENT_PAYLOAD_KEYS; string values capped at `maxEventPayloadValue` (100).
- `src/scripts/audit.ts` `markStarted()` (line ~502):
  ```ts
  function markStarted(): void {
    if (!started) {
      started = true;
      track("audit_started");
    }
  }
  ```
  `audit.ts` already imports `readAttribution` from `./analytics.ts`
  (line ~15) and uses it in `createDraft`.
- `src/scripts/analytics.ts`: `Attribution` interface has `utm_source?`,
  `utm_medium?`, `utm_campaign?`, `utm_content?`, `utm_term?`;
  `readAttribution()` returns the session record or null.
- The attribution caps: UTM values are capped at 200 chars by the AUDIT
  endpoint (`LIMITS.utm`), but the EVENT endpoint caps payload VALUES at 100
  chars — so the client must truncate UTM values to 100 before sending
  them in an event, or the event 400s.

## Repo conventions to match

- Payload whitelists are server-authoritative; the client mirrors limits
  with explicit comments (same pattern as plan 003's `ATTR_LIMITS`).
- Events carry no PII; campaign strings are marketing data, but keep them
  out of all other events and out of logs (the events endpoint never logs
  payloads — verify nothing new logs).
- Drift guard: `tests/audit-function.test.mjs` events tests + plan 017
  keep client keys and server whitelist in sync.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-function.test.mjs` and `node --test tests/audit-retry.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `functions/lib/contract.ts` (EVENT_PAYLOAD_KEYS only)
- `src/scripts/audit.ts` (markStarted payload)
- `tests/audit-function.test.mjs` (whitelist acceptance test)
- `tests/audit-retry.test.mjs` (audit_started carries UTM assertion)

**Out of scope** (do NOT touch):
- `functions/api/events.ts` — the validation logic already handles new
  whitelisted keys; no change needed.
- `src/scripts/analytics.ts` — attribution capture is unchanged; the
  payload is composed at the `track` call site.
- Adding UTM to `primary_cta_click`/other events — deliberately not done
  (data minimization; the funnel-top question is answered by
  `audit_started`).
- Plan 011's doc (it references this plan's key as provisional — updating
  the doc is a follow-up in that plan's maintenance note; do NOT edit it
  here).

## Git workflow

- Branch: `improve/013-utm-funnel-events`
- Commit message style (match the repo): `feat(analytics): attach utm source/medium/campaign to audit_started`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Whitelist the three UTM keys server-side

In `functions/lib/contract.ts`, extend `EVENT_PAYLOAD_KEYS`:

```ts
export const EVENT_PAYLOAD_KEYS = [
  "page",
  "section",
  "cta_id",
  "step",
  "service",
  "slug",
  "channel",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;
```

Add a comment: `// utm_* (plan 013): channel dimension on audit_started — campaign strings only, never PII`.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass (existing tests unaffected; the whitelist grows, nothing shrinks).

### Step 2: Send the attribution with audit_started

In `src/scripts/audit.ts`:

1. Add a module constant next to `ATTR_LIMITS`-style constants (or reuse
   the pattern from plan 003 if landed):
   ```ts
   /** Mirror of LIMITS.maxEventPayloadValue (functions/lib/contract.ts). */
   const EVENT_VALUE_LIMIT = 100;
   ```
2. Rewrite `markStarted()`:
   ```ts
   function markStarted(): void {
     if (started) return;
     started = true;
     // Channel dimension (plan 013): the funnel's top must be attributable —
     // the session capture (noveno:attribution) already has the UTM params;
     // truncate to the event payload value cap so the event never 400s.
     const a = readAttribution();
     const payload: Record<string, string> = {};
     if (a?.utm_source) payload.utm_source = a.utm_source.slice(0, EVENT_VALUE_LIMIT);
     if (a?.utm_medium) payload.utm_medium = a.utm_medium.slice(0, EVENT_VALUE_LIMIT);
     if (a?.utm_campaign) payload.utm_campaign = a.utm_campaign.slice(0, EVENT_VALUE_LIMIT);
     track("audit_started", payload);
   }
   ```
   (`track`'s payload type is `{ [key: string]: string | number }` — fine.)

**Verify**: `npm run check` exits 0.

### Step 3: Tests

1. In `tests/audit-function.test.mjs` (events section), extend the
   `validateEvent` acceptance test:
   ```js
   assert.equal(validateEvent({ name: "audit_started", payload: { utm_source: "instagram", utm_medium: "social" } }).ok, true);
   assert.equal(validateEvent({ name: "audit_started", payload: { utm_source: "x".repeat(101) } }).ok, false, "values over the 100-char cap must still be rejected");
   ```
2. In `tests/audit-retry.test.mjs`, add a test: before `initAudit`, seed
   the session attribution:
   ```js
   env.session.set("noveno:attribution", JSON.stringify({
     landing_page: "/", referrer: "", first_seen_at: "2026-08-01T00:00:00.000Z",
     utm_source: "instagram", utm_medium: "social", utm_campaign: "summer",
   }));
   ```
   walk the journey to the contact step, click next (fires `audit_started`
   via `markStarted` on the FIRST next-click), then force-flush the
   analytics queue by awaiting ~900 ms (the 800 ms idle flush) OR dispatch
   `pagehide` on the window stub if your harness records window listeners
   (see plan 007's analytics test for the flush pattern — the retry
   harness's `installGlobals` currently stubs `window.addEventListener =
   () => {}`, so the awaited-flush approach is the one that works there;
   mark the test `{ timeout: 3000 }`). Assert the captured beacon (extend
   `installGlobals`'s navigator stub to record beacons — plan 001 step 1
   already does this) contains
   `{ name: "audit_started", payload: { utm_source: "instagram",
   utm_medium: "social", utm_campaign: "summer", page: "/audit" } }`.
   Also assert a LONG utm value (300 chars) arrives truncated to 100.

**Verify**: `node --test tests/audit-function.test.mjs` and `node --test
tests/audit-retry.test.mjs` → all pass. Red-before-green: before Steps 1-2,
the retry test fails (beacon carries no utm keys — actually the beacon
carries `audit_started` with only `page`), and the whitelist acceptance
fails (validateEvent rejects utm_source).

## Test plan

- 2 test edits/additions (whitelist accept + cap rejection in
  audit-function; beacon-content + truncation in audit-retry).
- Pattern: existing events tests + the plan 001/007 beacon-capture helpers.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-function.test.mjs tests/audit-retry.test.mjs` exits 0
- [ ] `npm run check` exits 0; `npm run build` exits 0
- [ ] `grep -n "utm_source" functions/lib/contract.ts src/scripts/audit.ts` → both present
- [ ] `grep -rn "utm_source" src/scripts/analytics.ts` → still only in attribution capture (no new events send it)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The awaited-flush approach proves flaky (timing): first widen bounds;
  if still flaky, STOP and report (the flush-dispatach approach from plan
  007 may need to be backported into the retry harness first).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Plan 011's analytics-queries doc marks the channel query as "after plan
  013" — when this lands, that doc's section becomes current (update it in
  the same PR if convenient, or note it in the plan row).
- Plan 017's drift guard should include the new payload keys in its client
  event-payload-key list — coordinate so the literals match.
- UTM values longer than 100 chars are truncated in EVENTS only; the lead
  row keeps the full 200-char value (audit endpoint cap) — the lead is the
  analytic source of truth, events are funnel telemetry.
