# Plan 003: Make server-side 400 responses actionable and mirror attribution caps client-side

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 89708a7..HEAD -- src/scripts/audit.ts src/pages/audit.astro tests/audit-retry.test.mjs`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: plans/001-client-submit-and-web3forms-coverage.md (its
  error-banner coverage must land first so this change is red-protected)
- **Category**: bug
- **Planned at**: commit `89708a7`, 2026-08-13

## Why this matters

Two related gaps on the primary conversion path:

1. **Server 400 fields are ignored.** The function returns per-field message
   keys (`functions/api/audit.ts:85` → `errorResponse("validation", 400, result.fields)`),
   but the client never reads `error.fields` — on 400 it only shows the
   generic banner «یک مورد را کامل کنید» (`src/scripts/audit.ts:646-648`),
   which has no retry button and marks no field. A visitor whose submission
   was rejected server-side has no way to know what to fix.
2. **Attribution is captured unbounded client-side but capped server-side.**
   `captureAttributionNow()` stores `location.pathname + location.search`
   verbatim (`src/scripts/audit.ts:106-121`), and `buildPayload` forwards it
   unchanged; the server rejects `landing_page` > 500 chars, `referrer` >
   500, `utm_*` > 200, `first_seen_at` > 40 (`functions/lib/validate.ts:151-153`,
   `LIMITS` in `functions/lib/contract.ts:96-113`). A visitor arriving via a
   long tracking URL (several UTM params can easily exceed 500 chars) is
   guaranteed a 400 — i.e. silent lead loss — even though their form data is
   valid.

## Current state

- `functions/api/audit.ts:85`: `return errorResponse("validation", 400, result.fields);`
- `functions/lib/respond.ts`: `errorResponse` serializes
  `{ ok: false, error: { code, fields } }` when fields are present.
- `functions/lib/validate.ts` attribution check (lines ~148-157): caps via
  `LIMITS.landingPage` (500), `LIMITS.referrer` (500), `LIMITS.utm` (200),
  `LIMITS.firstSeenAt` (40), after `normalizePlain` (trim).
- `src/scripts/audit.ts`:
  - `captureAttributionNow()` (~106-121): `landing_page: location.pathname + location.search`, `referrer: document.referrer`, `first_seen_at: new Date().toISOString()`, plus `utm_*` from `location.search` — no truncation.
  - `buildPayload(token)` (~541-560): forwards `attribution` unchanged.
  - `submit()` 400 branch (~646-648):
    ```ts
    } else if (response.status === 400 || code === "validation") {
      // Server-side validation rejection — truthful copy, not "connection".
      showBanner("validation");
    }
    ```
  - `FIELD_ERROR_COPY` (~300-313): per-field copy map keyed by message key
    (`required` / `too_short` / `invalid` / `too_long`), empty `{}` for
    `customer_value_range`. Server keys also include `invalid_enum`,
    `invalid_uuid`, `invalid_date` (see `validate.ts` doc comment).
  - `showFieldError(fieldId, key)` (~352-372): looks up copy; if copy is
    `""` it hides the error slot (`errorEl.hidden = !copy`).
- `src/pages/audit.astro:168-177`: the `data-banner="validation"` block — a
  single paragraph, no retry button (retry exists only on
  network/offline/turnstile banners).
- `tests/audit-retry.test.mjs`: harness as described in plan 001; every
  field has a `${fieldId}-error` slot in the fake DOM; plan 001 adds the
  400-banner test that this plan extends with per-field assertions.

## Repo conventions to match

- Client-side constants mirror server limits WITHOUT importing
  `functions/lib/contract.ts` (client/server split is deliberate; the drift
  guard in `tests/audit-function.test.mjs` and plan 017 keep them honest).
  Name the client constants to make the mirror explicit (e.g. a comment
  `// mirror of functions/lib/contract.ts LIMITS — kept in sync by the drift
  guard`).
- Field-level errors use the existing `showFieldError`/`clearFieldError`
  path with `aria-invalid` + `aria-describedby` (DESIGN §11; the retry tests
  assert banner kinds, not copy).
- Persian copy: terse, non-hype, consistent with `FIELD_ERROR_COPY` tone.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Targeted tests | `node --test tests/audit-retry.test.mjs` | all pass |
| Typecheck | `npm run check` | exit 0 |
| Full app tests | `npm run test` | all pass |
| Build | `npm run build` | exit 0 |
| Affected route | `node scripts/verify-affected.mjs --file src/scripts/audit.ts` | routes to the app lane |

## Scope

**In scope** (the only files you should modify):
- `src/scripts/audit.ts`
- `tests/audit-retry.test.mjs`
- `src/pages/audit.astro` — ONLY if you need to adjust the validation
  banner's copy; prefer leaving it untouched.

**Out of scope** (do NOT touch):
- `functions/lib/validate.ts` / `functions/lib/contract.ts` — the server caps
  are authoritative and correct; the fix is client-side.
- `src/scripts/analytics.ts` — the session attribution capture stays as is;
  truncation happens at the payload boundary.
- The thank-you redirect behavior (plan 005).

## Git workflow

- Branch: `improve/003-audit-400-fields`
- Commit message style (match the repo): `fix(audit): surface server field errors and mirror attribution caps client-side`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Mirror the server attribution caps at the payload boundary

In `src/scripts/audit.ts`, add a module-level constant next to `DRAFT_KEY`:

```ts
/**
 * Mirror of functions/lib/contract.ts LIMITS for attribution fields —
 * the server caps are authoritative; truncating here means a legit
 * tracking URL can never cause a 400. Kept in sync by the drift guard.
 */
const ATTR_LIMITS = {
  landing_page: 500,
  referrer: 500,
  utm: 200,
  first_seen_at: 40,
} as const;
```

Add a helper near `buildPayload`:

```ts
function truncateAttribution(attribution: Attribution): Attribution {
  const truncate = (value: string | undefined, limit: number): string | undefined => {
    if (value === undefined) return undefined;
    const cleaned = value.trim();
    return cleaned.length > limit ? cleaned.slice(0, limit) : cleaned;
  };
  return {
    landing_page: truncate(attribution.landing_page, ATTR_LIMITS.landing_page),
    referrer: truncate(attribution.referrer, ATTR_LIMITS.referrer),
    utm_source: truncate(attribution.utm_source, ATTR_LIMITS.utm),
    utm_medium: truncate(attribution.utm_medium, ATTR_LIMITS.utm),
    utm_campaign: truncate(attribution.utm_campaign, ATTR_LIMITS.utm),
    utm_content: truncate(attribution.utm_content, ATTR_LIMITS.utm),
    utm_term: truncate(attribution.utm_term, ATTR_LIMITS.utm),
    first_seen_at: truncate(attribution.first_seen_at, ATTR_LIMITS.first_seen_at),
  };
}
```

In `buildPayload`, replace the attribution passthrough with
`attribution: truncateAttribution(d.attribution ?? captureAttributionNow())`
(the draft's attribution is `Attribution | null`; keep the existing fallback
expression, wrapped by the truncator).

**Verify**: `npm run check` exits 0; `node --test tests/audit-retry.test.mjs` still passes.

### Step 2: Surface server field errors on 400

In `submit()`, the response-body JSON is currently parsed after the
`response.ok` check into a local `body` scoped inside a `try` block. Restructure
so the parsed body is available in the 400 branch, then extend the 400 branch:

```ts
} else if (response.status === 400 || code === "validation") {
  // Server-side validation rejection — surface per-field errors (the
  // function returns semantic message keys in error.fields), then the
  // banner. Fields without a slot (e.g. attribution.*) stay banner-only.
  const fields = (body as { error?: { fields?: Record<string, string> } } | undefined)
    ?.error?.fields;
  if (fields && typeof fields === "object") {
    for (const [field, key] of Object.entries(fields)) {
      if (typeof key !== "string") continue;
      showFieldError(field, key);
    }
  }
  showBanner("validation");
}
```

(`showFieldError` already no-ops when `document.getElementById(\`${fieldId}-error\`)`
is missing — fake DOM and real DOM both have slots for the form fields, so
unknown/attribution keys are safely ignored.)

Then make unknown message keys visible instead of silently hiding the error:

1. In `FIELD_ERROR_COPY`, add `invalid_enum: "گزینه انتخاب‌شده معتبر نیست"` to
   the enum fields (`industry`, `primary_problem`, `requested_service`,
   `preferred_contact`, `customer_value_range`, `acquisition_channels`).
2. In `showFieldError`, change the fallback so an unknown key still renders
   a truthful message:
   ```ts
   const copy = FIELD_ERROR_COPY[fieldId]?.[key] ?? "این مورد را بررسی کنید";
   ```

**Verify**: `npm run check` exits 0; `node --test tests/audit-retry.test.mjs` passes.

### Step 3: Add defect-sensitive tests (extend plan 001's 400 test)

In `tests/audit-retry.test.mjs` add:

1. **400 with fields renders per-field errors**: scripted fetch returns
   `{ ok: false, status: 400, json: async () => ({ error: { code: "validation", fields: { name: "too_long", industry: "invalid_enum" } } }) }`.
   After submit, assert:
   - the `name-error` slot is not hidden and its `[data-error-text]` text is
     the `too_long` copy («نام خیلی طولانی است» — or whatever
     `FIELD_ERROR_COPY.name.too_long` holds at execution time);
   - `name` has `aria-invalid="true"`;
   - the `industry-error` slot is visible with the `invalid_enum` copy;
   - the validation banner is visible;
   - the submit button is re-enabled.
2. **Attribution truncation**: before `initAudit`, set
   `globalThis.location = { ...globalThis.location, search: "?utm_source=" + "a".repeat(300) + "&utm_campaign=xyz" }`.
   Complete the journey and submit successfully; assert
   `env.auditCalls[0].attribution.utm_source.length === 200` (capped) and
   `env.auditCalls[0].attribution.landing_page.length <= 500` (the pathname +
   300+ chars of search).
3. **400 with only attribution.* fields**: scripted fetch returns
   `fields: { "attribution.landing_page": "too_long" }`; assert no throw, the
   validation banner is visible, and no field error slot was touched.

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass. Red-before-green:
run the new tests against the pre-change `src/scripts/audit.ts` (stash step
1-2 changes) — test 1 fails (no field errors rendered), test 2 fails (utm
arrives at 300 chars).

## Test plan

- 3 new tests in `tests/audit-retry.test.mjs` (per-field 400 rendering with
  copy + aria-invalid; attribution truncation; attribution-only 400 no-crash).
- Pattern: plan 001's banner tests — same harness setup.
- Regression risk covered: the `showFieldError` fallback change must not
  alter existing client-validation behavior — the existing journey tests
  (validation-banner on empty step) already cover the client-only path.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/audit-retry.test.mjs` exits 0 with the 3 new tests
- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -n "ATTR_LIMITS" src/scripts/audit.ts` → defined and used in `buildPayload`
- [ ] `grep -n "error.fields" src/scripts/audit.ts` → the 400 branch reads it
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- You find the server's `fields` keys do NOT match field ids (e.g. server
  sends `attribution.landing_page` for a case the client can fix) — report
  the key inventory instead of inventing mappings.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If the server caps change (`functions/lib/contract.ts` LIMITS), the mirror
  `ATTR_LIMITS` must change too — plan 017's drift guard should grow a
  constant-level check; flag any divergence in review.
- If a new form field is added, the server's `fields` map keys must match the
  new field's element id for per-field errors to surface; the fallback copy
  («این مورد را بررسی کنید») guarantees no silent hide regardless.
- The truncation cuts long UTM values at 200 chars — intentional; the
  full-length value remains visible in the visitor's URL, and the lead row's
  attribution is the analytic source of truth.
