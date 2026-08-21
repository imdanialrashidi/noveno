# Plan 028: Spike — server-side email to replace Web3Forms client POST (D-01)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- functions/api/audit.ts src/scripts/audit.ts docs/ARCHITECTURE.md docs/ops/setup-checklist.md wrangler.jsonc .env.example package.json`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (spike: 1-2 days investigation + prototype; build-everything is L — intentionally scoped as spike)
- **Risk**: MED
- **Depends on**: 021 (mitigation — informs this spike's threat model); do not start this before 021 is DONE or REJECTED
- **Category**: direction / spike
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`D-01` is the strongest direction opportunity: it reclaims the trust boundary. Today the public `PUBLIC_WEB3FORMS_ACCESS_KEY` + direct `fetch(config.web3formsUrl)` means the server cannot prove a lead was validated, cannot dedupe, and cannot rate-limit the inbox (finding 02). Server-side email (Cloudflare Email Workers, Resend, or an SMTP via `fetch`) lets `/api/audit` send the lead **after** honeypot/rate-limit/Turnstile pass, using a **secret** API key — the key never touches the client, direct POSTs are impossible, and `submission_id` dedupe can be enforced with KV/D1 if desired. Architecture already makes this cheap: `handleAuditRequest` is testable pure + `onRequest` wiring (see `functions/api/audit.ts:20`), and the client already gates success on server acceptance. This spike must answer: which provider fits Cloudflare Pages free tier + Iranian deliverability, what the new secret surface is, and what the migration path from Web3Forms looks like — without building the whole feature.

## Current state

Relevant files:
- `functions/api/audit.ts` — validate-only boundary (`handleAuditRequest` pure + `onRequest` wiring with `verifyTurnstile`)
- `src/scripts/audit.ts:772-809` — client `deliverLead` + `buildWeb3FormsBody` (to be replaced by server send)
- `docs/ARCHITECTURE.md` — Lead delivery row documents email-only Web3Forms
- `docs/ops/setup-checklist.md:5-14` — Web3Forms provisioning steps (§2)
- `wrangler.jsonc` — `compatibility_date 2026-08-01`, `compatibility_flags ["nodejs_compat"]`, `analytics_engine_datasets`
- `.env.example` — `PUBLIC_WEB3FORMS_ACCESS_KEY`, `PUBLIC_WEB3FORMS_URL` (public), `TURNSTILE_SECRET_KEY` (secret)
- `package.json` — `astro 7.2.0`, `yaml`, `wrangler 4.120.1` (no email SDK)

Excerpt — `functions/api/audit.ts:22-50` (current validate-only):

```ts
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });
export async function handleAuditRequest(request: Request, deps: AuditDeps): Promise<Response> {
  // ... rate gate before parse, honeypot, validateAuditPayload, verifyTurnstile ...
  return jsonResponse({ ok: true, status: "validated" }, 200);
}
export const onRequest = (context: { request: Request; env: AuditEnv }): Promise<Response> => {
  const { request, env } = context;
  return handleAuditRequest(request, {
    rateLimiter: limiter,
    verifyTurnstile: async (submission, ip) =>
      verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token: submission.cf_turnstile_token, ... }),
  });
};
```

Excerpt — `src/scripts/audit.ts:772` (client delivery to be removed):

```ts
const result = await fetch(config.web3formsUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10_000),
});
```

Repo conventions:
- One narrowly scoped Pages Function per route (`functions/api/audit.ts`, `functions/api/events.ts`). Tests in `tests/audit-function.test.mjs` drive `handleAuditRequest` with injected deps — keep that pattern for an email-injected variant.
- Secrets live only in `env` (Cloudflare Pages secrets), never in `public/` or built output — see `tests/structural.test.mjs:250` no-secrets check.
- spikes produce a design doc + prototype under `research/` or `docs/exec-plans/active/`, not a production deploy — per `improve` skill direction guidance.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass (spike tests additive) |
| Build | `npm run build` | 19 pages |
| Spike prototype | `npx wrangler pages dev dist --compatibility-date=2026-08-01` | local preview (optional) |
| Provider docs | `web_fetch https://resend.com/docs/send-with-cloudflare-workers` etc. | for research |

## Scope

**In scope** (only files you should produce/modify for the spike):
- `docs/exec-plans/active/server-side-email-spike.md` (create) — decision doc: provider choice, secret surface, API shape, migration, cost, Iranian deliverability note, open questions
- `functions/api/audit.ts` — prototype branch (feature-flagged or separate file `functions/api/audit.email.ts`) that sends email server-side via one provider (Resend example) — behind a `USE_SERVER_EMAIL` flag or env check, not live by default
- `tests/audit-email-spike.test.mjs` (create) — contract: validated payload → email sent with same Persian labels + safeText + no Turnstile token; Turnstile fail → no email; upstream → 500 never sends
- `docs/ops/setup-checklist.md` — draft new provisioning steps for chosen provider (marked DRAFT / spike)

**Out of scope** (do NOT do in this spike):
- Deleting Web3Forms client code (`src/scripts/audit.ts` deliverLead) — that's the build-everything plan after spike approval
- Adding a KV/D1 dedupe store (evaluate in spike, don't implement)
- Changing `src/pages/audit.astro` client success semantics (still `validated` today; server-email changes it to `sent` — decide in spike, implement later)
- Billing/paid plan commitments

## Git workflow

- Branch: `advisor/028-server-side-email-spike`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed; spike stays on branch

## Steps

### Step 1: Research and write the spike decision doc

Create `docs/exec-plans/active/server-side-email-spike.md` with:

1. **Provider matrix** (3 rows: Cloudflare Email Workers, Resend, SMTP via MailChannels/forward):
   - Free tier limits, Cloudflare Pages compatibility (`nodejs_compat`), Iranian inbox deliverability (gmail/outlook reach), PII handling, rate limits.
   - Favor **Resend** (HTTP `fetch` API, no `net`/`smtp` native needed, free 100/day, `fetch` works in Workers) unless Cloudflare Email routing is already provisioned. Cite official docs (use `doc_search_get_library_docs` or `web_fetch` — record URLs).

2. **Secret surface**: new secret `RESEND_API_KEY` (or `SMTP_*`) in `AuditEnv`, never `PUBLIC_`. Old `PUBLIC_WEB3FORMS_*` stays until migration.

3. **API shape**: extend `AuditEnv` with `RESEND_API_KEY?`, `LEAD_TO_EMAIL?` (founder inbox). `handleAuditRequest` gains an injected `sendEmail` dep ` (lead: AuditSubmission) => Promise<{ok:boolean}>` — same injection pattern as `verifyTurnstile`. Return `200 { ok:true, status:"sent" }` on email accepted, `500` on failure (no false success), still `400/403/429` for validation paths.

4. **Client change (deferred)**: after spike, `src/scripts/audit.ts` `deliverLead` becomes a no-op — `onSuccess` fires on `response.ok && body.status==="sent"` (or `"validated"` during flag transition). Web3Forms config becomes unused.

5. **Migration**: Web3FormsInbox → ResendInbox — run both for 1 week with `USE_SERVER_EMAIL` flag, compare deliverability, then cut client code and rotate `PUBLIC_WEB3FORMS_ACCESS_KEY` (revoke at web3forms.com).

6. **Dedupe**: evaluate KV/D1 `submission_id` table (TTL 24h) — cost/benefit; if deferred, keep `submission_id` in email subject for manual dedupe (plan 025).

7. **Open questions**: e.g., Iranian sanctions on Resend? SPF/DKIM setup for `noveno.ir`? `EMAIL_FROM` domain? Analytics Engine still needed? List 3-5.

**Verify**: `npx tsc --noEmit` or `npm run check` → exit 0 (doc is markdown, no type impact)

### Step 2: Prototype the server send (feature-flagged, no client change yet)

In `functions/api/audit.ts` (or `functions/lib/email.ts` new file + wiring), add:

```ts
// functions/lib/email.ts — Resend via fetch, no new dependency
export async function sendLeadEmail(lead: AuditSubmission, env: AuditEnv): Promise<{ok:boolean}> {
  const key = (env as any).RESEND_API_KEY;
  if (!key) return { ok: false }; // spike: secret not configured → 500, not silent
  const body = { from: "Noveno <noreply@noveno.ir>", to: [(env as any).LEAD_TO_EMAIL ?? "imdanialrashidi@gmail.com"], subject: `درخواست بررسی مسیر جذب — ${safeText(lead.business_name ?? lead.name)}`, html: renderLeadHtml(lead) }; // Persian labels same as buildWeb3FormsBody
  const res = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  let accepted = res.ok;
  try { accepted = res.ok && (await res.json()).id !== undefined; } catch {}
  return { ok: accepted };
}
```

Wire into `handleAuditRequest` behind env check: if `env.RESEND_API_KEY` present, call `sendLeadEmail` after Turnstile pass and only then return `200 {status:"sent"}`; else keep current `validated`. This keeps the existing path green while the spike is evaluated.

Keep `safeText` sanitization (`<` `>` strip) from `src/scripts/audit.ts:847` — reuse in `functions/lib/email.ts` or import from `functions/lib/normalize.ts`.

**Verify**: `npm run check` → exit 0

### Step 3: Spike tests — prove the contract without needing real provider

Create `tests/audit-email-spike.test.mjs` (model after `tests/audit-function.test.mjs:300` handleAuditRequest pattern):

- `validated payload → email sent (resend mock ok)` — inject `sendEmail: async () => ({ok:true})`, assert `status: "sent"` and that Turnstile was verified once, and that email body contains Persian labels (`labelFor` from `src/data/audit.ts`) and no `cf_turnstile_token`/`company_website`.
- `turnstile fail → no email` — inject `verifyTurnstile: {status:"fail"}`, assert email not called, `403`.
- `email failure → 500 never success` — inject `sendEmail: async () => ({ok:false})`, assert `500` and no `sent`.
- `missing RESEND_API_KEY → 500 via flag` — no env key, assert 500 (or fallback `validated` depending on flag choice — pick one and pin it).

Use injected `sendEmail` mock array (`calls`) like `makeDeps` does for `verifyTurnstile`.

**Verify**: `npm test` → all pass (including new spike tests when feature flagged off, old tests still assert `validated`)

### Step 4: Document the cutover and rollback

In `docs/exec-plans/active/server-side-email-spike.md` append:

- Cutover: set `RESEND_API_KEY` + `LEAD_TO_EMAIL` in Pages project, deploy, verify preview inbox, then remove `PUBLIC_WEB3FORMS_*` from Pages + revert `public/_headers` CSP `connect-src` Web3Forms origin (plan 024) in same deploy.
- Rollback: unset `RESEND_API_KEY` → function falls back to `validated` (client still has Web3Forms path until client code cut). Full rollback = redeploy previous commit (per `docs/ARCHITECTURE.md` operational baseline).
- Cost: Resend free 100/day → ~3000 leads/month (far above expected SMB funnel).

**Verify**: `bash scripts/project-verify.sh` → no doc failures

## Test plan

- `tests/audit-email-spike.test.mjs` (new):
  - `validated → sent` — email called once, body has `submission_id`, Persian labels, no token/honeypot
  - `turnstile fail → no email` — email not called
  - `email fail → 500` — no false success
  - `receipt superseded` — if plan 021 receipt exists, spike doc explains it becomes unnecessary (server send is proof)
- Existing suites: `npm test` green with spike flag off (no regression)

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new file `tests/audit-email-spike.test.mjs` exists and passes (even if gated by env flag)
- [ ] `docs/exec-plans/active/server-side-email-spike.md` exists with provider matrix, secret surface, API shape, cutover, open questions (≥4 sections)
- [ ] `functions/lib/email.ts` or `functions/api/audit.ts` spike branch exists with `RESEND_API_KEY` guard (grep `RESEND_API_KEY` → hit)
- [ ] No Web3Forms client code deleted in this spike (`grep -n "web3forms" src/scripts/audit.ts` still hits)
- [ ] `docs/ops/setup-checklist.md` draft section marked `DRAFT (spike)` if added

## STOP conditions

Stop and report (do not improvise) if:

- No provider can be used from Cloudflare Workers `fetch` (e.g., Resend blocks Iranian domains, or Pages `nodejs_compat` breaks `fetch` with `Authorization: Bearer`) — document and propose alternative in spike doc, don't force a provider
- The spike requires weakening the Turnstile or validation gate to make email send — never skip validation for email
- Real inbox deliverability test is required to answer the spike (no test credentials) — record as open question with `docs/ops/setup-checklist.md` DRAFT, don't claim success

## Maintenance notes

- This spike supersedes mitigation plan 021 and doc plan 025 if approved — the receipt becomes unnecessary and client dedupe moves server-side. Keep the receipt in the spike prototype until cutover for additive proof, then remove it in the build-everything plan.
- Reviewer should check that `sendLeadEmail` never logs lead PII (same rule as `functions/api/audit.ts` — no lead content in logs) and that the HTML email template uses `safeText` + Persian labels (same as client `buildWeb3FormsBody`).
- If the spike is rejected (Web3Forms stays), mark this plan REJECTED with rationale and keep 021+025 as the mitigated state.
