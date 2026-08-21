# Spike — Server-side email to replace Web3Forms client POST (D-01)

**Status:** spike evaluated 2026-08-21 — provider recommended: Resend via `fetch` (no new infra)  
**Threat superseded:** plan 021 receipt mitigation + plan 025 client dedupe become unnecessary after cutover; keep receipt until cutover for additive proof.

## 1. Provider matrix

| Provider | API | Free tier | Pages `fetch` compat | Iranian deliverability | PII | Notes |
|---|---|---|---|---|---:|---|
| **Resend** (recommended) | `POST https://api.resend.com/emails` `Authorization: Bearer <key>` JSON | 100/day, 3000/mo | Yes — pure `fetch`, no `net`/`smtp`, works with `nodejs_compat` | Gmail/Outlook ok; Iranian `.ir` recipient fine; sending domain `noveno.ir` needs SPF/DKIM | To/subject/html only | Official docs: https://resend.com/docs/send-with-cloudflare-workers — `fetch` example, no SDK needed |
| Cloudflare Email Workers / MailChannels | Email Workers routing or MailChannels `fetch` | Email Workers free but routing-only; MailChannels deprecated 2024 | Workers fetch ok, but Email Workers requires zone email routing + worker, more ops | Same as Resend (recipient agnostic) | Same | More setup than Resend; not needed for 3k/mo |
| SMTP via `fetch` (e.g. generic SMTP POST) | `smtp`/`net` socket | varies | No — `net` not in Workers, would need service binding | — | — | Rejected: not Workers-compatible |

**Pick:** **Resend** — smallest code, no native, free tier far above expected SMB funnel (<10 leads/day), `fetch` timeout 10s matches existing delivery pattern.

## 2. Secret surface

- New secrets (Pages encrypted, never `PUBLIC_`): `RESEND_API_KEY` (Bearer), `LEAD_TO_EMAIL` (founder inbox, default `imdanialrashidi@gmail.com`), `EMAIL_FROM` (e.g. `Noveno <noreply@noveno.ir>` — domain must be verified in Resend, SPF/DKIM at Cloudflare DNS).
- Old `PUBLIC_WEB3FORMS_ACCESS_KEY` / `PUBLIC_WEB3FORMS_URL` stay until migration week, then revoke at web3forms.com and remove `connect-src https://api.web3forms.com` (plan 024) in same deploy.
- `TURNSTILE_SECRET_KEY` unchanged — still gates abuse before email.

## 3. API shape

Extend `AuditEnv`:
```ts
interface AuditEnv {
  TURNSTILE_SECRET_KEY: string;
  NOVENO_EVENTS?: unknown;
  RESEND_API_KEY?: string;
  LEAD_TO_EMAIL?: string;
  EMAIL_FROM?: string;
}
```

Inject `sendEmail` like `verifyTurnstile`:

```ts
export interface AuditDeps {
  verifyTurnstile: (submission: AuditSubmission, ip: string) => Promise<TurnstileOutcome>;
  rateLimiter: RateLimiter;
  receiptSecret?: string;
  sendEmail?: (lead: AuditSubmission) => Promise<{ok:boolean}>;
}
```

`handleAuditRequest` after Turnstile pass:
- if `deps.sendEmail` provided (spike flag = `RESEND_API_KEY` present), await `sendEmail(lead)` → `200 { ok:true, status:"sent" }` on ok, `500` on fail (no false success).
- else keep `200 { ok:true, status:"validated" }` (current path — spike is flag-gated, no regression).

Client (`src/scripts/audit.ts`) deferred: after spike, `deliverLead` becomes no-op; `onSuccess` fires on `body.status==="sent"` (or `"validated"` during flag transition). Spike leaves client untouched (`grep web3forms` still hits).

`sendLeadEmail` reuse: Persian labels from `src/data/audit.ts` via `AUDIT_OPTIONS` + `safeText` (`<` `>` strip) same as `buildWeb3FormsBody`; no `cf_turnstile_token` / `company_website` in email.

## 4. Client change (deferred)

Not in spike — after approval:
- Remove `deliverLead` / `buildWeb3FormsBody` fetch to Web3Forms, keep `submission_id` stable.
- Success = `response.ok && (body.status==="sent" || body.status==="validated")` during transition, then `"sent"` only.
- Web3Forms CSP origin removed.

## 5. Migration

1. Set `RESEND_API_KEY` + `LEAD_TO_EMAIL` in Pages (preview → prod).
2. Deploy spike-flagged function (flag on when `RESEND_API_KEY` set).
3. Run both 1 week: client still posts to Web3Forms but server also sends via Resend when flag on — compare inbox deliverability (Resend dashboard + inbox).
4. Cut: remove `PUBLIC_WEB3FORMS_*` from Pages + `public/_headers` CSP, delete client Web3Forms code, redeploy.
5. Revoke Web3Forms key at web3forms.com.
6. Cutover rollback: unset `RESEND_API_KEY` → function falls back to `validated` (client still has Web3Forms path until code cut). Full rollback = redeploy previous commit per `docs/ARCHITECTURE.md`.

## 6. Dedupe

- Spike evaluates KV/D1 `submission_id` TTL 24h (cost: KV 1M reads free, D1 5M rows free) — viable but deferred; manual `submission_id` email subject dedupe (plan 025) stays until volume justifies store.
- If deferred, keep `submission_id` in email subject for manual dedupe.

## 7. Open questions

1. Iranian sanctions on Resend? Check Resend ToS + Cloudflare: recipient `.ir` is fine, sender domain `noveno.ir` not sanctioned; still verify SPF/DKIM deliverability to Gmail before prod.
2. `EMAIL_FROM` domain verification: does `noreply@noveno.ir` require Resend domain verify + DNS TXT? Yes — check Resend docs, add to `setup-checklist` DRAFT.
3. SPF/DKIM for `noveno.ir` at Cloudflare DNS — who owns zone? Founder — add steps.
4. Analytics Engine still needed? Yes — funnel `audit_started/step_completed/submitted` stays via `/api/events`; spike reader (plan 031) independent.
5. Cost after free tier: Resend $20/10k emails — far above SMB funnel, no action.

## 8. Cutover & rollback (repeated for clarity)

- **Cutover** above; CSP `connect-src` Web3Forms origin removed in same deploy as client code cut.
- **Rollback** above.

**Verification:** `npm run check` passes (doc is md), spike prototype `functions/lib/email.ts` compiles, tests `tests/audit-email-spike.test.mjs` pin contract.
