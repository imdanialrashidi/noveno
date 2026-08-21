# Plan 021: Mitigate Web3Forms public-key bypass within the email-only architecture

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- src/pages/audit.astro src/scripts/audit.ts public/_headers .env.example docs/ARCHITECTURE.md docs/ops/setup-checklist.md tests/audit-retry.test.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 020 (timestamp fix — small, same trust-boundary area; run 020 first to avoid rebase churn)
- **Category**: security
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

The email-only architecture (`3e33265`) deliberately posts leads from the browser to `https://api.web3forms.com/submit` with a **public** `access_key` (`PUBLIC_WEB3FORMS_ACCESS_KEY`). An attacker can extract the key from `data-audit-config` and POST directly to Web3Forms, bypassing honeypot, rate-limit, and Turnstile — flooding the founder's inbox. Free-tier requires client-side posting, so this is a documented trade-off (`docs/ARCHITECTURE.md` Lead delivery row, `plans/README.md` rejected-finding note), but currently has **no compensating control**. This plan adds the cheapest intra-architecture mitigations (no new provider) and documents the residual risk, buying time for `D-01` (server-side email) which supersedes it.

## Current state

Relevant files:
- `src/pages/audit.astro:28-30` — exposes `web3formsKey` + `web3formsUrl` in `data-audit-config`
- `src/scripts/audit.ts:41-42, 620, 772, 807` — `AuditConfig`, guard, delivery fetch, payload builder
- `public/_headers:54` — CSP `connect-src` hard-codes Web3Forms origin
- `.env.example` — `PUBLIC_WEB3FORMS_ACCESS_KEY=` documented as public by design
- `tests/audit-retry.test.mjs` — covers delivery success/failure, no bypass test

Excerpt — `src/pages/audit.astro:28-30`:

```ts
const web3formsKey = import.meta.env.PUBLIC_WEB3FORMS_ACCESS_KEY ?? "";
const web3formsUrl = import.meta.env.PUBLIC_WEB3FORMS_URL ?? "https://api.web3forms.com/submit";
const auditConfig = { turnstileSiteKey, web3formsKey, web3formsUrl };
```

Excerpt — `src/scripts/audit.ts:41-42` & `:620`:

```ts
export interface AuditConfig {
  turnstileSiteKey: string;
  web3formsKey: string;
  web3formsUrl: string;
}
if (!config.turnstileSiteKey || !config.web3formsKey) {
  showBanner("unconfigured");
  return;
}
```

Excerpt — `src/scripts/audit.ts:772` + `:807`:

```ts
const result = await fetch(config.web3formsUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10_000),
});
return { access_key: config.web3formsKey, subject: `...`, ... }
```

Excerpt — `public/_headers:54`:

```
Content-Security-Policy: ... connect-src 'self' https://challenges.cloudflare.com https://api.web3forms.com https://cloudflareinsights.com https://static.cloudflareinsights.com; ...
```

Repo conventions:
- Security fixes keep `risk-review` discipline: validate at boundaries, enforce server-side, never expose secrets (here the key is *intentionally* public — document it).
- Tests use `node:test`; follow `tests/audit-retry.test.mjs` fake-DOM + scriptable fetch pattern.
- CSP lives in `public/_headers` (immutable on `/images/*`, short-lived on `/og/*`) — see `docs/HARNESS.md` verification lanes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | 19 pages |
| Headers check | `grep -c "api.web3forms.com" public/_headers` | reflects mitigations |
| CSP check | `npm test -- --test-name-pattern="audit-retry"` | audit retry suite passes |

## Scope

**In scope** (only files you should modify):
- `src/scripts/audit.ts` — add signed validation receipt + bot mitigations
- `functions/api/audit.ts` — issue HMAC-signed receipt on `validated`
- `public/_headers` — tighten CSP if needed (no broad `*`)
- `docs/ARCHITECTURE.md` — document residual risk + mitigations
- `docs/ops/setup-checklist.md` — clarify PUBLIC_ vs SECRET and rotation
- `tests/audit-retry.test.mjs` or new `tests/web3forms-bypass.test.mjs` — prove mitigations

**Out of scope** (do NOT touch):
- Changing `PUBLIC_WEB3FORMS_ACCESS_KEY` to a secret (would break free-tier client POST — that's `D-01`)
- Switching provider (Resend/Email Workers — that's `D-01`)
- `functions/api/events.ts` (plan 022)
- Visual/design tokens, `src/data/site.ts`

## Git workflow

- Branch: `advisor/021-web3forms-bypass-mitigation`
- Commit per step; conventional commits (e.g., `fix(security): ...` — see `git log --oneline`)
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Issue a validation receipt from the server (HMAC over submission_id + timestamp)

The cheapest proof that the payload passed honeypot/rate-limit/Turnstile is a **server-issued receipt** that the client must echo to Web3Forms. Web3Forms cannot verify it, but the founder can (subject/body) and future automation can.

1. In `functions/api/audit.ts`, after `turnstile.status === "pass"` and before `jsonResponse`, create:
   ```ts
   // Receipt: HMAC_SHA256(submission_id + "|" + issuedAt, TURNSTILE_SECRET_KEY) — reuses existing secret as HMAC key (no new secret needed for mitigation).
   // IssuedAt = ISO timestamp of validation. Valid for e.g. 10 minutes.
   // Response: { ok: true, status: "validated", receipt: "<submission_id>.<issuedAt>.<hex-hmac>" }
   ```
   Use `crypto.subtle` (available in Cloudflare Workers) — same API as `idempotencyKeyForToken`. If `crypto.subtle` unavailable, fall back to no receipt (graceful — client still delivers without it, but inbox shows missing receipt).

2. Include `receipt` in the JSON 200 only — never on error responses.

**Verify**: `npm run check` → exit 0

### Step 2: Echo receipt + hardening in the client delivery

In `src/scripts/audit.ts`:

1. After `response.ok` + `validated` check, extract `receipt` from the JSON body (if present) and thread it through `deliverLead(payload, receipt)`.

2. `buildWeb3FormsBody` — add `validation_receipt: receipt ?? "none"` and `validated_at: new Date().toISOString()` (or the server's `issuedAt` if you echo it). Keep `safeText` stripping for all free-text fields (already at `:847` `value.replace(/[<>]/g,"")`).

3. **Honeypot symmetry**: keep `company_website` honeypot echoed at `src/scripts/audit.ts:572` (`company_website: honeypot?.value ?? ""`) — already matches `functions/lib/validate.ts:62` `honeypotTriggered`. No change needed, but add a test that non-empty honeypot never reaches Web3Forms (already asserted at `tests/audit-retry.test.mjs:765`).

4. **Rate-limit UX**: no client change — server rate-limit remains `10/min/ip` at `functions/api/audit.ts:22`. Document that client-side Web3Forms cannot be rate-limited by the server.

**Verify**: `npm run check` → exit 0; `npm test` still passes (receipt is optional — old tests with mocked `/api/audit` must handle missing receipt gracefully)

### Step 3: Document residual risk

Update two docs (keep short, no secrets):

1. `docs/ARCHITECTURE.md` — Lead delivery row: add one paragraph after "email is the destination": "Mitigation 021: `/api/audit` issues a short-lived HMAC receipt; the client echoes it in the Web3Forms `validation_receipt` field so the inbox (and future automation) can distinguish validated leads from direct POSTs. Direct POSTs remain possible — `D-01` removes this vector entirely."

2. `docs/ops/setup-checklist.md` — clarify `PUBLIC_WEB3FORMS_ACCESS_KEY` is public by design, `TURNSTILE_SECRET_KEY` is the HMAC key for receipts and must be rotated if exposed, and how to recognize `validation_receipt: none` in the inbox.

**Verify**: `bash scripts/project-verify.sh` → no doc contract failures (if script exists)

### Step 4: Tests — prove receipt is issued and echoed, and that direct POSTs lack it

Extend `tests/audit-retry.test.mjs` (or create `tests/web3forms-bypass.test.mjs` following its fake-DOM pattern):

- `audit validation receipt is echoed in Web3Forms body` — mock `/api/audit` to return `{ ok:true, status:"validated", receipt:"<id>.<ts>.<hmac>" }`, assert `web3Posts[0].body` contains `validation_receipt` with that value.
- `delivery without server validation has no receipt` — simulate direct fetch to Web3Forms URL with no prior `/api/audit` — no receipt field or `"none"` (depending on implementation).
- Existing `"Web3Forms success: exactly one delivery POST …"` test at `audit-retry.test.mjs:724` should still pass — receipt is additive, not breaking.

**Verify**: `npm test` → all pass (including new bypass tests)

### Step 5: CSP review (no broad change)

Check `public/_headers:54` — ensure `connect-src` still pins `https://api.web3forms.com` (no `*`, no `https:` wildcard). If `PUBLIC_WEB3FORMS_URL` override is kept, note in `docs/ops/setup-checklist.md` that CSP must be updated when the URL changes (handled fully in plan 024). No code change in this step unless you choose to add a comment in `_headers` pointing to plan 024.

**Verify**: `npm run build` → 19 pages; `grep connect-src public/_headers` shows no wildcard

## Test plan

- Tests to extend/create (follow `tests/audit-retry.test.mjs:330` fake-DOM + `makeTurnstileMock` + `installGlobals`):
  - Happy: receipt issued by `handleAuditRequest` (inject `TURNSTILE_SECRET_KEY` env, assert `body.receipt` matches `submission_id`-derived HMAC pattern `/^[0-9a-f-]{36}\.\d{4}-\d{2}-\d{2}T.*\.[0-9a-f]{64}$/`)
  - Client echo: `web3Posts(env)[0].body.validation_receipt === receipt`
  - Negative: direct POST bypass → receipt absent/`"none"`
  - Regression: `npm test` — existing audit-retry + audit-function suites green
- Verification: `npm test` → 189+ tests (new ones included), `npm run check` 0 errors

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new test `validation receipt is echoed` exists and passes
- [ ] `grep -rn "validation_receipt" src/scripts/audit.ts functions/api/audit.ts` returns hits
- [ ] `grep -rn "validation_receipt: none\|receipt.*none" src/scripts/audit.ts` documents fallback
- [ ] `docs/ARCHITECTURE.md` mentions `validation_receipt` / `D-01`
- [ ] `public/_headers` `connect-src` has no `*` and no `https:` wildcard (`grep "connect-src.*\*" public/_headers` empty)
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- `crypto.subtle` is not available in the Functions runtime where you test (receipt cannot be computed) — report and propose fallback (plain `issuedAt` without HMAC, still useful)
- `functions/api/audit.ts` wiring has drifted (e.g., `verifyTurnstile` signature changed) — compare with "Current state" excerpt
- Adding `receipt` to the 200 response breaks any existing client test that asserts exact body shape (`tests/audit-function.test.mjs:320` `status: "validated"` check) — update tests to allow additive `receipt` instead of failing the gate
- `D-01` has already been implemented (server-side email exists) — this plan is then obsolete; mark REJECTED with rationale

## Maintenance notes

- This is a **mitigation, not a fix** — the true fix is `D-01` (server-side email). Keep the receipt field even after `D-01` as an audit trail.
- Reviewer should ensure `receipt` is HMAC'd with the server secret, not a plain timestamp that attackers can forge, and that the inbox subject/body clearly shows receipt presence/absence.
- Future: if Web3Forms is replaced, the receipt becomes the email's `X-Validation-Receipt` header — same HMAC, different transport.
- Rotation: changing `TURNSTILE_SECRET_KEY` invalidates outstanding receipts (≤10 min) — acceptable; document in `docs/ops/runbook.md` if rotation procedure lands.
