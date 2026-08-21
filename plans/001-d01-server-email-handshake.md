# Plan 001: Align the D‑01 server-email handshake so `status:"sent"` completes the journey

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2df2e69bb6..HEAD -- functions/api/audit.ts functions/lib/email.ts functions/lib/contract.ts src/scripts/audit/index.ts src/scripts/audit/delivery.ts tests/audit-retry.test.mjs tests/audit-email-spike.test.mjs docs/exec-plans/active/server-side-email-spike.md`
> If any of these files changed since the plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the primary conversion success gate)
- **Depends on**: none
- **Category**: bug (correctness + security-posture alignment)
- **Planned at**: commit `2df2e69bb6`, 2026-08-21

## Why this matters

The repo carries an approved migration path ("D‑01"): server-side lead email via Resend,
activated by setting the `RESEND_API_KEY` Pages secret. The shipped server half returns
`{ ok: true, status: "sent" }` when that secret is present — but the client accepts only
`status === "validated"` as success. The moment the founder follows `docs/ops/setup-checklist.md`
§2a (which instructs provisioning `RESEND_API_KEY`), every audit submission will show the
«ارسال نشد» failure banner, never reach `/audit/thank-you`, never clear the draft — while the
server has already emailed the lead — and each manual retry re-sends the email. That is exactly
the false-failure / duplicate-delivery mode the project's "truthful success" invariant forbids.
Two existing tests pin each half separately (`tests/audit-email-spike.test.mjs` pins the server's
`"sent"`; `tests/audit-retry.test.mjs` pins the client rejecting any non-`"validated"` 2xx), so CI
is green while the seam between them is broken.

This plan implements the transition semantics already recorded in
`docs/exec-plans/active/server-side-email-spike.md` §4: during transition the client accepts both
`"sent"` and `"validated"`, Web3Forms delivery still runs (the documented "run both for a week"
comparison), and the HMAC receipt keeps being issued so the inbox can distinguish validated leads.

It also fixes two adjacent defects on the same path so the D‑01 path is trustworthy end-to-end:

1. The duplicate Persian label table in `functions/lib/email.ts` has already drifted from the
   canonical labels visitors actually see (`clinic_health`, `education`, `referral`, `in_person`,
   plus several more) — a lead emailed via D‑01 would carry wrong industry/channel labels.
2. The receipt is currently _not issued at all_ on the `"sent"` path, contradicting spike doc §7
   ("keep receipt until cutover"), and the client reverse-engineers `validated_at` by positional
   slicing of the receipt string.

## Current state

### Server: `functions/api/audit.ts`

The sendEmail branch short-circuits before the receipt block (excerpt, lines ~126–145):

```ts
// Spike D-01: server-side email takes precedence when configured — validated leads are emailed
// before any client delivery. This is flag-gated: no sendEmail dep → legacy "validated" path.
if (deps.sendEmail) {
  const sent = await deps.sendEmail(submission);
  if (!sent.ok) return errorResponse("server_error", 500);
  return jsonResponse({ ok: true, status: "sent" }, 200);
}
```

And below it, the validated path issues the receipt:

```ts
if (deps.receiptSecret) {
  const issuedAt = new Date().toISOString();
  const receipt = await createValidationReceipt(submission.submission_id, issuedAt, deps.receiptSecret);
  if (receipt) {
    return jsonResponse({ ok: true, status: "validated", receipt }, 200);
  }
}
return jsonResponse({ ok: true, status: "validated" }, 200);
```

`createValidationReceipt(submissionId, issuedAt, secret)` returns `` `${submissionId}.${issuedAt}.${hex}` ``
(HMAC-SHA256 hex over `` `${submissionId}|${issuedAt}` ``, key = `deps.receiptSecret`, which
`onRequest` wires to `env.TURNSTILE_SECRET_KEY`). It can return `null` if Web Crypto is unavailable.

`onRequest` (bottom of file) wires `sendEmail` whenever `RESEND_API_KEY` is set:

```ts
  const hasServerEmail = Boolean((env as AuditEnv & { RESEND_API_KEY?: string }).RESEND_API_KEY);
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    receiptSecret: env.TURNSTILE_SECRET_KEY,
    sendEmail: hasServerEmail ? (lead) => sendLeadEmail(lead, env) : undefined,
    ...
```

Note the env casts: `AuditEnv` (in `functions/lib/contract.ts`) does not declare
`RESEND_API_KEY` / `LEAD_TO_EMAIL` / `EMAIL_FROM`; every consumer casts locally. You will extend
`AuditEnv` instead.

### Client: `src/scripts/audit/index.ts` (submit function, ~lines 430–447)

```ts
      if (response.ok) {
        let validated = true;
        let receipt: string | null = null;
        try {
          const body = (await response.json()) as { status?: string; receipt?: string };
          validated = body.status === "validated";
          if (typeof body.receipt === "string" && body.receipt.length > 0) receipt = body.receipt;
        } catch {
          /* unreadable body — the server contract still holds */
        }
        if (!validated) {
          bridge?.invalidate();
          showBanner(navigator.onLine === false ? "offline" : "network");
          setSubmitting(false);
          return;
        }
        const delivered = await deliverLead(payload, config, receipt);
```

Any 2xx whose JSON body is not `status:"validated"` is treated as a network failure: banner, no
Web3Forms delivery, no thank-you.

### Client: `src/scripts/audit/delivery.ts` (~lines 44–56) — receipt slicing

```ts
const attribution = payload.attribution as Record<string, string> | undefined;
let validatedAt = new Date().toISOString();
if (receipt) {
  const lastDot = receipt.lastIndexOf(".");
  if (lastDot > 36) validatedAt = receipt.slice(37, lastDot);
}
```

`buildWeb3FormsBody(...)` returns an object that includes `validation_receipt: receipt ?? "none"`
and a `validated_at` field derived above (inspect the full return object when editing).

### Server labels: `functions/lib/email.ts` (module-private `AUDIT_OPTIONS`, ~lines 12–63)

The comment says "replicate labels here to keep functions self-contained". Drift is already
present (canonical values live in `src/data/audit.ts` `AUDIT_OPTIONS`):

| id              | functions/lib/email.ts (wrong) | src/data/audit.ts (canonical) |
| --------------- | ------------------------------ | ----------------------------- |
| `clinic_health` | «کلینیک و سلامت»               | «کلینیک و خدمات درمانی»       |
| `education`     | «آموزش»                        | «آموزشگاه و آموزش»            |
| `referral`      | «معرفی»                        | «معرفی مشتریان قبلی»          |
| `in_person`     | «حضوری»                        | «مراجعه حضوری»                |

The `problems`, `needs`, `valueRanges` groups are also shortened/simplified versus canonical — do
not hand-patch individual strings; replace whole groups by copying from `src/data/audit.ts`.

The only test touching these labels (`tests/audit-email-spike.test.mjs`) imports the canonical
`AUDIT_OPTIONS` from `../src/data/audit.ts` and asserts against it, so the private copy's drift is
invisible today.

### Recorded decision you must honor (quote from the source of truth)

`docs/exec-plans/active/server-side-email-spike.md` §4:

> Success = `response.ok && (body.status==="sent" || body.status==="validated")` during
> transition, then `"sent"` only.

and §5.3: "Run both 1 week: client still posts to Web3Forms but server also sends via Resend when
flag on — compare inbox deliverability."

So during transition BOTH emails fire (Resend + Web3Forms) and the journey must complete once.
`docs/ARCHITECTURE.md` invariant: "Success semantics are truthful: the visitor reaches thank-you
only after [delivery] confirms acceptance." Do not change that ordering — only widen the accepted
server status vocabulary.

### Repo conventions that apply

- Client modules are framework-free TypeScript under `src/scripts/`, strict TS (`astro check`
  enforces). Comments explain rationale in English; all user-facing strings are Persian.
- Tests use `node:test` + `node:assert/strict`. Journey tests live in `tests/audit-retry.test.mjs`
  (self-contained fake DOM/globals via `installGlobals(...)`, Turnstile mock with `emitToken`,
  scriptable fetch). Server contract tests live in `tests/audit-function.test.mjs` /
  `tests/audit-email-spike.test.mjs` (dependency-injected `makeDeps()`).
- Commit style: conventional commits, e.g. `fix(security): harden /api/events payload validation`.

## Commands you will need

| Purpose                  | Command                                                                      | Expected on success    |
| ------------------------ | ---------------------------------------------------------------------------- | ---------------------- |
| Typecheck                | `npm run check`                                                              | exit 0, no errors      |
| Build                    | `npm run build`                                                              | exit 0, writes `dist/` |
| Server tests             | `node --test tests/audit-function.test.mjs tests/audit-email-spike.test.mjs` | all pass               |
| Client journey tests     | `node --test tests/audit-retry.test.mjs`                                     | all pass               |
| Full suite (after build) | `npm test`                                                                   | all pass               |
| Full gate                | `bash scripts/verify.sh`                                                     | exit 0                 |

Run `npm run build` before `npm test`: structural suites assert against `dist/` and fail on a
clean checkout otherwise (pinned by `tests/gate-order.test.mjs`).

## Scope

**In scope** (the only files you should modify):

- `functions/api/audit.ts` — sent-path response shape
- `functions/lib/contract.ts` — extend `AuditEnv`
- `functions/lib/email.ts` — canonicalize labels, export the table
- `src/scripts/audit/index.ts` — accept `"sent"` during transition, prefer explicit `validated_at`
- `src/scripts/audit/delivery.ts` — prefer explicit `validated_at` field
- `tests/audit-function.test.mjs` — new sent-path assertions
- `tests/audit-email-spike.test.mjs` — fix tautology ONLY as noted in Step 5 (full test-integrity work is plan 005)
- `tests/audit-retry.test.mjs` — update drift-guard test, add `"sent"` journey test
- `docs/ops/setup-checklist.md` — correct the receipt-TTL sentence only as instructed (Step 6)
- `plans/README.md` — status row

**Out of scope** (do NOT touch):

- Removing the Web3Forms client delivery or CSP entry (`connect-src https://api.web3forms.com`)
  — that is the later cutover step, explicitly out of this transition-alignment plan.
- Any change to rate limiting, honeypot, or Turnstile verification order.
- `functions/lib/rate-limit.ts`, `functions/api/events.ts`.
- Rotating or referencing any secret value anywhere.

## Git workflow

- Branch: `improve/001-d01-handshake`
- Commits per logical unit, conventional style, e.g.:
  - `fix(audit): issue receipt on the D-01 sent path (+ explicit validated_at)`
  - `fix(audit): accept status:"sent" during D-01 transition (spike §4)`
  - `fix(audit): single-source Persian labels for server email + drift guard`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend `AuditEnv` with the optional D-01 fields

In `functions/lib/contract.ts`, find `AuditEnv` (it currently declares
`TURNSTILE_SECRET_KEY: string` and `NOVENO_EVENTS?: unknown`). Add three optional fields:

```ts
export interface AuditEnv {
  TURNSTILE_SECRET_KEY: string;
  NOVENO_EVENTS?: unknown;
  /** Spike D-01 (server-side email): presence of RESEND_API_KEY arms the sent path */
  RESEND_API_KEY?: string;
  LEAD_TO_EMAIL?: string;
  EMAIL_FROM?: string;
}
```

Then simplify the casts in `functions/lib/email.ts` (`env as AuditEnv & { ... }` → `env`) and in
`functions/api/audit.ts`'s `onRequest`. Keep behavior identical.

**Verify**: `npm run check` → exit 0.

### Step 2: Issue a receipt on the `"sent"` path + add explicit `validated_at` to both success responses

Restructure the tail of `handleAuditRequest` so both success paths share one response builder:

```ts
// Both success paths carry a short-lived HMAC receipt (Mitigation 021) and an
// explicit validated_at timestamp so the client never parses the receipt format.
const issuedAt = new Date().toISOString();
let receipt: string | null = null;
if (deps.receiptSecret) {
  receipt = await createValidationReceipt(submission.submission_id, issuedAt, deps.receiptSecret);
}

if (deps.sendEmail) {
  const sent = await deps.sendEmail(submission);
  if (!sent.ok) return errorResponse("server_error", 500);
  return jsonResponse(
    receipt
      ? { ok: true, status: "sent", receipt, validated_at: issuedAt }
      : { ok: true, status: "sent", validated_at: issuedAt },
    200,
  );
}

return jsonResponse(
  receipt
    ? { ok: true, status: "validated", receipt, validated_at: issuedAt }
    : { ok: true, status: "validated", validated_at: issuedAt },
  200,
);
```

Preserve the existing explanatory comments (validation ≠ delivery confirmation; Mitigation 021).
Update the doc comment at the top of `handleAuditRequest`'s sendEmail branch to note the receipt
now rides on the sent path too.

**Verify**: `node --test tests/audit-function.test.mjs` → all pass (some may assert exact body
shapes; update those assertions to the additive fields — additions only, never remove fields).

### Step 3: Client accepts `"sent"` during transition

In `src/scripts/audit/index.ts` submit(), change:

```ts
validated = body.status === "validated";
```

to:

```ts
// D-01 transition (spike §4): accept both statuses while Web3Forms
// delivery still runs client-side. After cutover this narrows to "sent".
validated = body.status === "validated" || body.status === "sent";
```

Also capture the optional `validated_at` field into the parsed-body read:

```ts
const body = (await response.json()) as { status?: string; receipt?: string; validated_at?: string };
```

and thread `body.validated_at ?? null` into the `deliverLead(payload, config, receipt)` call —
which requires changing `deliverLead`'s signature (see Step 4).

**Verify**: `npm run check` → exit 0 (you will get a type error until Step 4 updates
`deliverLead`; that is expected mid-step).

### Step 4: Prefer explicit `validated_at` over receipt slicing

In `src/scripts/audit/delivery.ts`, change the `deliverLead` signature to accept
`validatedAt: string | null` as a fourth parameter, and replace the slicing block:

```ts
let validatedAtIso =
  validatedAt && !Number.isNaN(Date.parse(validatedAt)) ? validatedAt : new Date().toISOString();
```

Delete the `lastIndexOf(".")`/`slice(37, lastDot)` parsing entirely and use `validatedAtIso` in
the returned object. Update the doc comment: "validated_at comes from the server's 200 body;
the fallback clock is only for direct/unconfigured deployments."

Update the internal caller(s): `deliverLead` is exported from `delivery.ts` and called once from
`index.ts` submit() (Step 3) — grep to confirm: `grep -rn "deliverLead" src/ tests/`. The
journey-test harness in `tests/audit-retry.test.mjs` calls the module through the page script, so
no direct harness signature changes should be needed; if a test imports `buildWeb3FormsBody`
directly, pass `null` there.

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

### Step 5: Canonicalize the email label table + add a drift guard

1. In `functions/lib/email.ts`, delete the entire private `AUDIT_OPTIONS` object and re-export
   the canonical one:

```ts
import { AUDIT_OPTIONS } from "../../src/data/audit.ts";
export { AUDIT_OPTIONS };
```

Keep `labelOf(group, id)` but re-type it against the imported value
(`keyof typeof AUDIT_OPTIONS`). Copy nothing by hand — the import replaces the whole table.

2. In `tests/audit-email-spike.test.mjs`, add a drift-guard test:

```ts
import { AUDIT_OPTIONS as SERVER_LABELS } from "../functions/lib/email.ts";

test("email label table matches the form's canonical AUDIT_OPTIONS (no drift)", () => {
  assert.deepEqual(SERVER_LABELS, AUDIT_OPTIONS);
});
```

(`AUDIT_OPTIONS` is already imported in that file from `../src/data/audit.ts`.)

3. While editing that file, fix the tautological assertion in the "email failure → 500" test:

```ts
// before (asserts a value against itself — always passes):
assert.equal(calls.email.length, undefined ?? calls.email.length, "email was attempted");
// after:
assert.equal(calls.email.length, 1, "email was attempted");
```

**Verify**: `node --test tests/audit-email-spike.test.mjs` → all pass, including the new drift
guard. If the deepEqual fails, copy the group verbatim from `src/data/audit.ts` into the import —
never edit `src/data/audit.ts` to match the old server copy.

> Note: importing `../../src/data/audit.ts` from a function bundles pure data + small string
> helpers into the Worker bundle — that module has no browser/DOM references, which is why this
> direction is safe. If `astro check` or the build disagrees, STOP (see conditions).

### Step 6: Add the `"sent"` journey test + align the drift guard

In `tests/audit-retry.test.mjs`:

1. Find the existing test around line ~999 asserting that a non-`"validated"` 2xx is a failure
   (message text like "non-validated 2xx"). Update it: `"sent"` now succeeds (thank-you +
   Web3Forms POST recorded), while a genuinely unknown status (e.g. `"future_status"`) still
   fails. Keep both cases in the test with clear names.
2. Add a journey test: drive the full happy path with the audit endpoint responding
   `200 {ok:true,status:"sent",receipt:"<any-nonempty>",validated_at:"2026-08-21T00:00:00.000Z"}`
   (see neighboring tests for how the scriptable fetch queue is primed). Assert:
   - the Web3Forms POST was attempted exactly once (transition run-both semantics),
   - its body carries `validation_receipt` equal to the served receipt and
     `validated_at` equal to the served timestamp (NOT a slice of the receipt),
   - the draft cleared and `location.assign("/audit/thank-you")` fired.

**Verify**: `node --test tests/audit-retry.test.mjs` → all pass.

### Step 7: Correct the setup-checklist receipt sentence

`docs/ops/setup-checklist.md:22` claims "outstanding receipts ≤10 min". No code verifies TTL
today (that is deliberate until the cutover removes receipts — see Maintenance notes). Reword the
parenthetical to match reality without weakening the rotation advice:

> "`TURNSTILE_SECRET_KEY` is the HMAC key — rotate it if exposed. The receipt is advisory until
> the D‑01 cutover (no automated verifier yet); treat `validation_receipt != none` as a hint, not
> proof."

Do not change anything else in that file (its DRAFT section stays accurate).

**Verify**: `grep -n "outstanding receipts" docs/ops/setup-checklist.md` → no matches.

## Test plan

New/changed tests (all in existing files, following their local patterns):

- `tests/audit-email-spike.test.mjs`: label-drift `deepEqual` guard; tautology fix (exact count 1).
- `tests/audit-function.test.mjs`: sent-path returns `receipt` + ISO `validated_at`; validated-path
  body gains `validated_at` (update exact-shape assertions additively).
- `tests/audit-retry.test.mjs`: unknown-status failure case retained; `"sent"` journey success
  case with receipt echo + explicit timestamp assertion.

Red-first check where practical: run the new `"sent"` journey test BEFORE making the Step 3
client change and confirm it fails (banner path, no thank-you) — that proves the test detects the
defect this plan fixes. Then apply Step 3 and watch it go green.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm run build` exits 0
- [ ] `node --test tests/audit-function.test.mjs tests/audit-email-spike.test.mjs tests/audit-retry.test.mjs` all pass
- [ ] `npm test` passes after `npm run build`
- [ ] `grep -n "lastIndexOf" src/scripts/audit/delivery.ts` → no matches
- [ ] `grep -rn "replicate labels here" functions/` → no matches (private table gone)
- [ ] New drift-guard test exists and passes
- [ ] `bash scripts/verify.sh` exits 0
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The code at the excerpted locations does not match (drift since planning).
- Importing `../../src/data/audit.ts` from `functions/lib/email.ts` breaks `astro check`, the
  Astro build, or produces Worker-incompatible output (do NOT fall back to re-copying labels —
  report instead; the alternative design needs a human decision).
- An existing test asserts the exact ABSENCE of `validated_at`/`receipt` on either success path
  and cannot be updated additively without weakening a security-relevant claim.
- You find yourself needing to change `public/_headers` CSP or delete Web3Forms client code
  (cutover territory — out of scope).

## Maintenance notes

- After the D‑01 cutover (Web3Forms removed), narrow the accepted status back to `"sent"` only,
  delete `deliverLead`/`buildWeb3FormsBody`, drop `connect-src https://api.web3forms.com`, and
  revoke the Web3Forms key — the checklist and spike doc own that sequence; keep them current.
- Receipt TTL remains unenforced by design until cutover; if receipts ever gain an automated
  verifier (inbox-export tooling, webhook), add timing-safe compare + TTL enforcement then, and
  consider deriving the receipt key via HKDF from `TURNSTILE_SECRET_KEY` instead of reusing it
  directly (recorded audit observation, deliberately deferred — low likelihood, full-width HMAC).
- Reviewers should scrutinize: the client gate widening (no other status accepted), that the
  run-both window cannot double-clear the draft, and that no test was deleted or weakened.
