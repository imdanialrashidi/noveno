# Plan 010: Harden the `/api/events` ingestion (enum values, path-like page, cross-site guard)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report per the format your reviewer
> gave you. Do NOT update `plans/README.md` — your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 13ef792..HEAD -- functions/ tests/audit-function.test.mjs`
> Compare the "Current state" excerpts against the live code. On a mismatch,
> treat it as a STOP condition and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `13ef792`

## Why this matters

`POST /api/events` is an unauthenticated, metered write path into Analytics
Engine. It whitelists payload *keys* but accepts any string *values* —
a bot (or a compromised page) can flood syntactically valid events that burn
the metered quota and pollute every funnel report built on them, and
"no PII" is client discipline only (a phone number fits in `slug`). Two
other gaps: no content-type check, and no cross-site guard — a foreign page
can `navigator.sendBeacon` (no-cors, no preflight) valid events from an
innocent visitor's browser. This plan: enum-validate the fixed-set payload
keys (`step`, `service`, `channel`), constrain `page` to path-like and
`slug`/`section`/`cta_id` to safe character sets, and reject cross-site
requests via the Origin header.

## Current state

- `functions/lib/contract.ts:70-88` — `EVENT_NAMES` and
  `EVENT_PAYLOAD_KEYS` (page, section, cta_id, step, service, slug, channel);
  `LIMITS.maxEventPayloadValue: 100`, `maxEventPayloadBytes: 1024`.
- `functions/api/events.ts:15-51` — `validateEvent()`: key whitelist +
  string/number type checks + length caps; values otherwise free-form.
- `functions/api/events.ts:63-118` — `onRequest`: 60/min per-IP per-isolate
  limiter (`eventsLimiter`), body-size checks, `JSON.parse`, `validateEvent`,
  write to `NOVENO_EVENTS` binding, 501-degraded, 204 on success. No
  content-type check, no Origin check.
- Known payload values in the codebase (grep-verified):
  - `page`: `location.pathname` (always starts with `/`)
  - `section`: `hero`, `blog-article`, `blog-hero`, `header`, `cta-section`,
    `mobile-menu`, `contact`
  - `step`: audit step ids `business`, `channels`, `problem`, `value`,
    `need`, `contact` (from `src/data/audit.ts` `AUDIT_STEPS`)
  - `service`: `REQUESTED_SERVICES` values (contract.ts)
  - `channel`: `whatsapp`, `telegram` (contact.astro) — subset of
    `PREFERRED_CONTACTS` (contract.ts)
  - `slug`: work/blog slugs (lowercase + hyphens)
  - `cta_id`: currently unused anywhere

## Commands you will need

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Boundary tests | `node --test tests/audit-function.test.mjs` | all pass |
| Full suite | `npm test`                  | all pass |
| Build      | `npm run build`             | exit 0 |

## Scope

**In scope**:
- `functions/lib/contract.ts`
- `functions/api/events.ts`
- `tests/audit-function.test.mjs`

**Out of scope** (do NOT touch):
- `src/scripts/analytics.ts`, `src/pages/*`, `src/data/*` (client values stay
  as-is; the endpoint is the enforcement point)
- `functions/api/audit.ts` (Turnstile-gated already; the Origin guard here is
  for the ungated events endpoint)
- `functions/lib/rate-limit.ts`, `functions/lib/respond.ts`
- Any other file.

## Git workflow

- Commit once at the end:
  `fix(security): harden /api/events payload validation and cross-site guard`
- Do NOT push or open a PR.

## Steps

### Step 1: Add the value whitelists to the contract

In `functions/lib/contract.ts`, add near the existing enums:

```ts
/** Audit step ids — the canonical step values for analytics events. */
export const EVENT_STEP_IDS = [
  "business",
  "channels",
  "problem",
  "value",
  "need",
  "contact",
] as const;

/** Payload value patterns for the events endpoint (non-enum keys). */
export const EVENT_VALUE_PATTERNS = {
  /** page = location.pathname — always a leading-slash path. */
  page: /^\/[^\s]{1,99}$/,
  /** slug = content slugs (work/blog entries). */
  slug: /^[a-z0-9-]{1,80}$/,
  /** section / cta_id — word chars (incl. Persian) + hyphen, ≤ 40. */
  wordish: /^[\p{L}\p{N}_-]{1,40}$/u,
} as const;
```

**Verify**: `node --test tests/audit-function.test.mjs` still passes.

### Step 2: Enforce the values in `validateEvent`

In `functions/api/events.ts`, inside `validateEvent`, after the key
whitelist check, validate values by key (import `EVENT_STEP_IDS`,
`REQUESTED_SERVICES`, `ACQUISITION_CHANNELS`, `PREFERRED_CONTACTS`,
`EVENT_VALUE_PATTERNS` from contract.ts):

```ts
const ENUM_VALUES = {
  step: new Set<string>(EVENT_STEP_IDS),
  service: new Set<string>(REQUESTED_SERVICES),
  channel: new Set<string>(PREFERRED_CONTACTS),
};
```

Rules (reject → `{ ok: false }`):

- `step` / `service` / `channel`: when present, must be a string in the
  matching set (numbers rejected).
- `page`: when present, must match `EVENT_VALUE_PATTERNS.page`.
- `slug`: must match `EVENT_VALUE_PATTERNS.slug`.
- `section` / `cta_id`: must match `EVENT_VALUE_PATTERNS.wordish`.
- Unknown keys are already rejected by the key whitelist; numbers remain
  allowed only for keys that legitimately carry them — none do today, so
  keep the existing `string | number` type check as-is (do not silently
  break future numeric payloads) but apply the patterns to strings.

**Verify**: `node --test tests/audit-function.test.mjs` — the existing
events tests must still pass (they use valid values like
`{ page: "/audit" }`, `{ step: "2" }` — check: the flood test uses
`payload: { page: "/audit" }` ✓; there is a test with `{ step: "2" }` in
blobs — read the tests around line 750-790 and, if `step: "2"` is used,
update that fixture to a valid step id like `"business"` ONLY IF the test's
purpose is not specifically about numeric values; report in NOTES if you
change a fixture).

### Step 3: Cross-site Origin guard

In `functions/api/events.ts` `onRequest`, before the limiter (or right
after the method check), add:

```ts
// Cross-site guard: a foreign page can send no-cors beacons that look
// like our own events. Browsers attach Origin to cross-site POSTs; a
// non-null Origin whose host differs from the request Host is rejected.
const origin = request.headers.get("origin");
const host = request.headers.get("host") ?? "";
if (origin && !origin.startsWith("https://") && !origin.startsWith("http://")) {
  // opaque origin ("null") from sandboxed pages — reject: our own pages
  // never send an opaque Origin for same-origin fetch/beacon.
  return errorResponse("validation", 400);
}
if (origin) {
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) return errorResponse("validation", 400);
  } catch {
    return errorResponse("validation", 400);
  }
}
```

(Follow the existing `errorResponse` usage in the file. If the repo's CSP
or Pages config already restricts origins, note it in the plan report —
the guard is still correct defense-in-depth.)

**Verify**: `node --test tests/audit-function.test.mjs` — existing events
tests build `Request` objects via a `post()` helper; if that helper doesn't
set an Origin header, the guard passes them (no Origin → no rejection).
Add new tests (Step 4) for the guard.

### Step 4: Regression tests

In `tests/audit-function.test.mjs` (events section), add tests:

1. Enum enforcement: `step: "not_a_step"` → 400; `service: "build_system"`
   → 204 (with a stub binding); `channel: "whatsapp"` → 204; `channel:
   "whatsapp"` with `step: "contact"` → 204.
2. Pattern enforcement: `page: "not-a-path"` → 400; `page: "/audit"` → 204;
   `slug: "Bad Slug!"` → 400; `section: "hero"` → 204; `section: "bad
   section!"` → 400.
3. Cross-site: request with `Origin: https://evil.example` and a Host header
   of the site → 400; `Origin: https://noveno.ir` + `Host: noveno.ir` →
   204 (adjust host to whatever the `post()` helper sets — read it first);
   no Origin → 204.
4. Content-type: a request with `content-type: text/plain` → still 204
   (beacons send Blob JSON; do not reject on content-type — document why in
   a comment: `sendBeacon` uses `text/plain` for string bodies but Blob
   types are preserved; JSON.parse remains the actual gate).

**Verify**: `node --test tests/audit-function.test.mjs` → all pass with the
new tests.

## Test plan

- New tests per Step 4 in `tests/audit-function.test.mjs`, following the
  existing events test style (see the `post()` helper and the
  `NOVENO_EVENTS` stub binding used by the flood test).
- Defect sensitivity: the enum/pattern tests fail on the pre-fix code
  (values accepted freely).

## Done criteria

- [ ] `EVENT_STEP_IDS` + `EVENT_VALUE_PATTERNS` in `functions/lib/contract.ts`
- [ ] `grep -n "Origin" functions/api/events.ts` → the guard present
- [ ] `node --test tests/audit-function.test.mjs` passes with the new tests
- [ ] `npm test` and `npm run build` pass
- [ ] No files outside the in-scope list modified

## STOP conditions

Stop and report back (do not improvise) if:

- A current page sends payload values that the new rules would reject
  (grep `data-event-payload` and `track(` in `src/` first; the values listed
  in "Current state" were verified, but confirm).
- The `post()` test helper cannot set headers — then adapt the helper
  minimally (add an optional headers arg) and note it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The Origin guard treats an opaque `Origin: null` as invalid — same-origin
  fetches from modern browsers send the real origin; if a legit privacy
  browser ever breaks, revisit with an allowlist instead of weakening this.
- When a new step id or contact channel is added, `EVENT_STEP_IDS` /
  `PREFERRED_CONTACTS` must be updated — the client↔server drift guard
  test at `tests/audit-function.test.mjs:709` may need an extension for
  step ids (add the step-ids subset assertion there if it does not exist —
  see the "client option ids are exactly the server enum whitelists" test).
- Residual risk (documented, accepted): per-IP per-isolate 60/min limiter
  only; a distributed flood still costs quota. A daily cap would need a KV
  store — out of scope for a static Pages function.
- Reviewer should scrutinize: the regexes use the `u` flag (Node ≥ 19
  supports `\p{L}`), and that no legit client payload is rejected.
