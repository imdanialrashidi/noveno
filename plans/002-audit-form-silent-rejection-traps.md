# Plan 002: Make audit-form rejection impossible for valid input (channel cap + attribution clamps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- functions/lib/contract.ts functions/lib/validate.ts src/data/audit.ts src/scripts/audit/index.ts src/scripts/audit/draft.ts tests/validation-equivalence.test.mjs tests/audit-retry.test.mjs`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (independent of plan 001; if 001 landed first, re-read its updated excerpts)
- **Category**: bug (conversion-path correctness)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

Two classes of _valid_ visitor input are silently rejected on the primary conversion surface:

1. **Channel cap mismatch.** The form offers **7** acquisition channels and invites «هر تعداد که
   درست است انتخاب کنید» ("select however many are right"). The server caps `acquisition_channels`
   at **6**, so selecting all seven yields a 400 `too_long`. Worse, the client has no error copy
   registered for that field at all — so even the _required_ error is currently invisible. The
   user sees only a generic banner and cannot fix anything; a real lead is lost.
2. **Long tracking URLs.** `landing_page` attribution is composed as `location.pathname +
location.search` with no clamp; the server hard-rejects any attribution field over its length
   limit (~500 chars for `landing_page`). A visitor arriving via a long UTM blob can never submit.

Both fixes stay inside the accepted architecture: client validation remains UX-only, the server
stays authoritative, and every new client-side bound mirrors an existing server `LIMITS` value.

## Current state

### Server contract: `functions/lib/contract.ts`

- Line ~30: `export const ACQUISITION_CHANNELS = ["instagram","google","advertising","referral","in_person","website","other"] as const;` — **7 entries**.
- Line ~142: `maxChannels: 6,` inside `LIMITS`, with a comment claiming "one full pass over the
  enum + slack" — wrong for a 7-entry enum.
- Lines ~130–145: `LIMITS` also defines per-field caps including `landingPage: 500` and caps for
  the other attribution strings (`referrer`, `utm_*`). Read the whole `LIMITS` block before
  Step 4 and record each attribution cap value — you will mirror them client-side.

### Server validation: `functions/lib/validate.ts`

```ts
// line ~109
/* acquisition_channels — non-empty, whitelisted, deduped */
if (!Array.isArray(raw.acquisition_channels)) {
  fail("acquisition_channels", "required");
} else {
  const channels = [...new Set(raw.acquisition_channels)];
  if (channels.length === 0) fail("acquisition_channels", "required");
  else if (channels.length > LIMITS.maxChannels) fail("acquisition_channels", "too_long");
```

```ts
// line ~150 area: attribution loop
check("landing_page", LIMITS.landingPage, "landing_page");
// ... same pattern for referrer / utm_source / utm_medium / utm_campaign / utm_content / utm_term
```

A failed attribution check produces `fields["attribution.landing_page"] = "too_long"` → 400.

### Client data + validation: `src/data/audit.ts`

- `AUDIT_OPTIONS.channels` (lines ~32–40): 7 options, canonical Persian labels.
- `validateFieldClient("acquisition_channels", ...)` returns `""` always — "array check happens at
  step level".
- `requiredFieldsForStep("channels")` → `["acquisition_channels"]`.

### Client journey: `src/scripts/audit/index.ts`

```ts
// line ~82: FIELD_ERROR_COPY has NO acquisition_channels entry at all:
const FIELD_ERROR_COPY: Record<string, Record<string, string>> = {
  name: { required: "...", too_short: "...", too_long: "..." },
  ...
  preferred_contact: { required: "روش دلخواه تماس را انتخاب کنید" },
  customer_value_range: {},
};
```

```ts
// line ~275 (validateStep): only emptiness is checked
const filled = fieldId === "acquisition_channels" ? multi.length > 0 : value.trim() !== "";
```

`showFieldError(fieldId, key)` looks up `FIELD_ERROR_COPY[fieldId]?.[key] ?? ""`; when the copy is
empty it hides the error element — so today even the _required_ message never renders for this
field (the generic banner shows instead). The DOM side is fine:
`src/components/ui/MultiSelect.astro` already renders `<p id="acquisition_channels-error"
data-field-error hidden>` with a `[data-error-text]` span — only the copy map and cap logic are
missing.

### Client attribution composition: `src/scripts/audit/draft.ts`

```ts
// captureAttributionNow(), lines ~59–73
const params = new URLSearchParams(location.search);
const attribution: Attribution = {
  landing_page: location.pathname + location.search,
  referrer: document.referrer,
  first_seen_at: new Date().toISOString(),
};
for (const key of ["utm_source", ...] as const) { ... }
```

No clamping anywhere; `buildPayload()` in `src/scripts/audit/index.ts` forwards
`attribution.landing_page` etc. verbatim.

### Equivalence test to extend

`tests/validation-equivalence.test.mjs` pins client↔server validation parity (phone/email/caps).
It imports from both `src/data/audit.ts` and `functions/lib/contract.ts` — follow its existing
pattern.

### Repo conventions

- All user-facing copy in Persian; comments in English explaining rationale.
- Server is authoritative; client mirrors server limits deliberately (see the phone comment in
  `src/data/audit.ts`: "mirrors server LIMITS.name").
- Tests: `node:test` + strict assert; journey harness lives in `tests/audit-retry.test.mjs`.

## Commands you will need

| Purpose                  | Command                                             | Expected on success |
| ------------------------ | --------------------------------------------------- | ------------------- |
| Typecheck                | `npm run check`                                     | exit 0              |
| Build                    | `npm run build`                                     | exit 0              |
| Server tests             | `node --test tests/audit-function.test.mjs`         | all pass            |
| Equivalence tests        | `node --test tests/validation-equivalence.test.mjs` | all pass            |
| Journey tests            | `node --test tests/audit-retry.test.mjs`            | all pass            |
| Full suite (after build) | `npm test`                                          | all pass            |
| Full gate                | `bash scripts/verify.sh`                            | exit 0              |

Run `npm run build` before `npm test` (structural suites read `dist/`).

## Scope

**In scope**:

- `functions/lib/contract.ts` — `maxChannels` value + comment
- `src/scripts/audit/index.ts` — channel cap check + FIELD_ERROR_COPY entry
- `src/scripts/audit/draft.ts` — attribution clamp helper
- `tests/audit-function.test.mjs` — server-side boundary tests (7 channels OK, 8 rejected)
- `tests/validation-equivalence.test.mjs` — cap-parity invariant
- `tests/audit-retry.test.mjs` — client cap UX + attribution clamp cases
- `plans/README.md` — status row

**Out of scope**:

- `MultiSelect.astro` markup (error slot exists), chip keyboard navigation, any styling.
- Changing any other `LIMITS` value.
- Server-side truncation of attribution (rejected design — see Maintenance notes).
- `functions/api/events.ts`.

## Git workflow

- Branch: `improve/002-form-silent-traps`
- Conventional commits, e.g.:
  - `fix(audit): raise maxChannels to enum size + surface channel errors`
  - `fix(audit): clamp attribution strings to server LIMITS client-side`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Raise the server cap to the enum size

In `functions/lib/contract.ts` set `maxChannels: ACQUISITION_CHANNELS.length` (derive it — the
constant is defined in the same file above `LIMITS`) and replace the stale comment with:

```ts
/** Upper bound == full enum pass; a user may legitimately select every channel. */
maxChannels: ACQUISITION_CHANNELS.length,
```

**Verify**: `node --test tests/audit-function.test.mjs` → all pass (no test should have pinned 6;
if one did, update it to assert the invariant below instead of the literal).

### Step 2: Register visible Persian error copy for the channels field

In `src/scripts/audit/index.ts`, add to `FIELD_ERROR_COPY` (keep alphabetical/grouping order of
the existing keys):

```ts
acquisition_channels: {
  required: "حداقل یک کانال ورود مشتری را انتخاب کنید",
  too_long: "بیشتر از این گزینه انتخاب نشود؛ فقط کانال‌های اصلی را علامت بزنید",
  invalid_enum: "یکی از گزینه‌های فهرست را انتخاب کنید",
},
```

(These strings must be natural Persian; they render under the chips via the existing
`#acquisition_channels-error` slot.)

**Verify**: `npm run check` → exit 0.

### Step 3: Enforce the cap client-side (UX-only, server stays authoritative)

In `validateStep()` (`src/scripts/audit/index.ts`), extend the multiselect branch:

```ts
const filled = fieldId === "acquisition_channels" ? multi.length > 0 : value.trim() !== "";
if (!filled) {
  showFieldError(fieldId, "required");
  valid = false;
} else if (fieldId === "acquisition_channels" && multi.length > MAX_CLIENT_CHANNELS) {
  // Mirrors functions/lib/contract.ts LIMITS.maxChannels — server is authoritative.
  showFieldError(fieldId, "too_long");
  valid = false;
} else { ...existing... }
```

Define `MAX_CLIENT_CHANNELS` once near `FIELD_ERROR_COPY` with a comment pointing at the contract
file. Do NOT block chip clicks in `MultiSelect.astro` — the step-validation error is the single
source of feedback (keeps the component dumb and matches how text `maxlength` overflow is handled
elsewhere in this form).

**Verify**: `node --test tests/audit-retry.test.mjs` → existing journey tests still pass.

### Step 4: Clamp attribution strings client-side

Add one helper in `src/scripts/audit/draft.ts` mirroring the server caps (read the exact values
from `functions/lib/contract.ts` `LIMITS` first and reference them in comments):

```ts
import {
  LIMITS /* adjust import path: functions/lib/contract.ts */,
} from "../../../functions/lib/contract.ts";

function clampAttr(value: string | undefined, max: number): string {
  return typeof value === "string" && value.length > max ? value.slice(0, max) : (value ?? "");
}
```

Apply it in `captureAttributionNow()` so drafts store clamped values:

```ts
landing_page: clampAttr(location.pathname + location.search, LIMITS.landingPage),
referrer: clampAttr(document.referrer, LIMITS.referrer),
...
attribution[key] = clampAttr(params.get(key) ?? undefined, LIMITS[key]);
```

(Adjust to the real `LIMITS` key names you find — e.g. there may be a single `attrField` cap or
per-key caps like `utm`.) Keep the change minimal and typed; `Attribution` field types stay
`string`.

If importing across `functions/` into a browser module trips `astro check` or the build, STOP —
same platform rule as plan 001 (report; do not hand-copy the numbers without flagging it).

**Verify**: `npm run check` → exit 0; `npm run build` → exit 0.

### Step 5: Pin both behaviors with tests

1. `tests/audit-function.test.mjs` (server truth):
   - a payload with all **7** distinct valid channels → 200;
   - a payload with an 8th injected id → 400 `fields.acquisition_channels === "invalid_enum"`
     (whitelist still binds).
2. `tests/validation-equivalence.test.mjs`: add an invariant test —
   `assert.equal(LIMITS.maxChannels, AUDIT_OPTIONS.channels.length)` with a comment naming this
   plan's regression.
3. `tests/audit-retry.test.mjs` (client journey):
   - select 7 chips → goNext shows `aria-invalid` on the field + non-empty
     `#acquisition_channels-error` text (use the harness's element registry; mirror neighboring
     validation-state tests);
   - select 7 chips with the server cap raised → after Step 1+3 the same selection now passes
     validation (this documents that the cap, not the UI, was the blocker);
   - attribution clamp unit case: call `captureAttributionNow()` with
     `location.search` longer than the cap → returned `landing_page.length <= LIMITS.landingPage`.
     Follow the suite's existing globals-installation pattern for `location`.

Red-first where practical: run the new journey assertions before Steps 3–4 land and confirm they
fail, then watch them pass.

**Verify**: `node --test tests/audit-function.test.mjs tests/validation-equivalence.test.mjs tests/audit-retry.test.mjs` → all pass.

## Test plan

Summarized above (Step 5). Structural pattern references:

- Server boundary cases: model after the existing validate-ordering tests in
  `tests/audit-function.test.mjs`.
- Journey validation states: model after the per-field error tests in
  `tests/audit-retry.test.mjs` (they already assert `aria-describedby` linkage).

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0; `npm run build` exits 0
- [ ] `grep -n "maxChannels: 6" functions/lib/contract.ts` → no matches
- [ ] `grep -n "acquisition_channels" src/scripts/audit/index.ts` shows a `FIELD_ERROR_COPY`
      entry AND the cap branch
- [ ] All three targeted test files pass; `npm test` passes after a fresh build
- [ ] A payload with exactly 7 distinct valid channels returns 200 from `handleAuditRequest`
- [ ] `bash scripts/verify.sh` exits 0
- [ ] No files outside the in-scope list modified; `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Excerpts don't match live code (drift).
- Cross-importing `functions/lib/contract.ts` into `src/scripts/audit/draft.ts` fails typecheck or
  build (do not duplicate the numeric caps silently — report).
- Any existing test asserts the literal cap `6` in a way that encodes intended product behavior
  rather than the old bug (needs a human product call).
- Raising the cap breaks the structural client↔server enum drift guard (it shouldn't — ids don't
  change — but verify).

## Maintenance notes

- If a channel id is ever added to `ACQUISITION_CHANNELS`, `maxChannels` now follows
  automatically; the equivalence test keeps the client comment honest only if someone re-hardcodes
  `MAX_CLIENT_CHANNELS` — prefer deriving it from `AUDIT_OPTIONS.channels.length` there too if a
  refactor touches it.
- Reviewers should confirm no user-visible copy was invented beyond the three registered messages
  and that the server cap derivation uses `.length`, not a literal.
- Deliberately rejected alternative: truncating over-limit attribution server-side. Rejection
  reason: silently mutating data crossing a trust boundary is worse than bounding it at capture;
  the client clamp preserves the server's reject-don't-mutate posture.
