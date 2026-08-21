# Noveno Launch — Founder Setup Checklist

Provisioning steps for production readiness. **No deployment is executed from
this repository** — this checklist prepares the accounts so a single
`git push` to `main` + a Pages production deploy can go live.

There is **no database** and **no Supabase step**. Audit leads are delivered
as email via **Web3Forms** — the only lead-delivery destination.

## 1. Cloudflare Turnstile (anti-abuse)

1. Dashboard → Turnstile → Add site (domain: your Pages domain, e.g.
   `noveno.ir`; widget mode: managed/managed-non-interactive).
2. Copy **Site Key** → `PUBLIC_TURNSTILE_SITE_KEY` (public, build-time).
3. Copy **Secret Key** → `TURNSTILE_SECRET_KEY` (Pages secret, server-only).
4. Local testing without a real key: official test keys
   (`1x00000000000000000000AA` sitekey / `1x0000000000000000000000000000000AA`
   secret) — they work on localhost; **never configure them in production**.

## 2. Web3Forms (lead email delivery — the sole lead destination)

> **Security note (plan 021):** `PUBLIC_WEB3FORMS_ACCESS_KEY` is public by design (client-side posting). An attacker who extracts it can POST directly to Web3Forms, bypassing honeypot/rate-limit/Turnstile. Mitigation: `/api/audit` issues a short-lived HMAC receipt (`validation_receipt`) that the client echoes to Web3Forms — validated leads carry a receipt, direct POSTs show `validation_receipt: none` in the inbox. `TURNSTILE_SECRET_KEY` is the HMAC key — rotate it if exposed. The receipt is advisory until the D‑01 cutover (no automated verifier yet); treat `validation_receipt != none` as a hint, not proof. `D-01` (server-side email) will remove this vector entirely.

1. Create an access key at <https://web3forms.com> (free; email to the
   founder inbox). Web3Forms posts happen **client-side** after `/api/audit`
   returns `validated` (the official API recommends browser-side submission;
   server-side requires a paid plan + server IP whitelisting).
2. Copy the **Access Key** → `PUBLIC_WEB3FORMS_ACCESS_KEY` (public by design).
   Set it as a build-time variable in the Pages project settings (§3.3) and
   in the local `.env` (`cp .env.example .env`) so local builds also deliver.
   (No access-key value is ever committed to the repository — the value
   lives only in Pages project settings and the gitignored local `.env`.)
3. Delivery is the **completion gate**: the visitor reaches thank-you only
   after Web3Forms confirms `{ success: true }`. A delivery failure shows a
   truthful retry banner (values preserved) — the lead is never silently lost
   or falsely confirmed.

## 2a. Server-side email (DRAFT — spike D-01, not live)

> **DRAFT (spike):** if D-01 is approved, Web3Forms client code will be removed. Provision Resend: dashboard → API Keys → Create key → copy → `RESEND_API_KEY` (Pages secret), verify `noveno.ir` domain (Resend → Domains → TXT SPF/DKIM at Cloudflare DNS), set `LEAD_TO_EMAIL` (founder inbox) and `EMAIL_FROM` (e.g. `Noveno <noreply@noveno.ir>`). Spike prototype: `functions/lib/email.ts` uses `fetch https://api.resend.com/emails` with `Authorization: Bearer <key>`; no new npm dep. Cutover: deploy preview with `RESEND_API_KEY`, verify inbox, then revoke Web3Forms key and remove `connect-src https://api.web3forms.com` (plan 024). Rollback: unset `RESEND_API_KEY` → fallback `validated`. See `docs/exec-plans/active/server-side-email-spike.md`.

## 3. Cloudflare Pages (hosting + functions + analytics)

1. Create a Pages project (`noveno`) connected to the GitHub repo; build
   command `npm run build`, output directory `dist` (functions directory is
   auto-detected as `functions/`).

   **Node version:** the repo ships `.node-version` (`22.23.2`, matching the
   package `engines` requirement `>=22.19`). The Pages build image honors
   `.node-version` / `.nvmrc` at the repo root, so the build uses 22.23.2
   instead of the image default (22.16.0 on v2). Do not set a `NODE_VERSION`
   project variable that contradicts it.

2. Production branch: `main`. **Compatibility flag `nodejs_compat` is
   already committed in `wrangler.jsonc`** — confirm it shows in the project
   settings (Settings → Functions → Compatibility flags).
3. Environment variables:
   - **Build-time (public):** `APP_ENV=production`, `PUBLIC_APP_URL`,
     `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_WEB3FORMS_ACCESS_KEY`,
     `PUBLIC_CF_ANALYTICS_TOKEN` (optional; from Web Analytics dashboard).
   - **Secret (encrypted, server-only):** `TURNSTILE_SECRET_KEY`.
4. **Analytics Engine binding:** create dataset `noveno_events` (Dashboard →
   Analytics Engine) and bind it as `NOVENO_EVENTS` on the Pages project
   (Settings → Functions → Bindings → Analytics Engine). The events endpoint
   degrades to 501 until the binding exists — the site keeps working.
5. Optional: Cloudflare Web Analytics site → token → `PUBLIC_CF_ANALYTICS_TOKEN`.

## 4. Local development

```bash
cp .env.example .env          # fill PUBLIC_* test values (names only in git)
npm install
npm run dev                   # UI at http://localhost:4321
```

- Use the official Turnstile **test keys** locally.
- Analytics Engine is not available in `wrangler pages dev` → `/api/events`
  returns 501; the client ignores it. Verify events on a preview deploy.
- Full local journey: `node scripts/slice2-test-server.mjs [--mode ok|web3forms-down|turnstile-fail]`
  serves the built site + real functions with a mock Web3Forms endpoint
  (build first with `PUBLIC_WEB3FORMS_URL=http://127.0.0.1:8788/api/web3forms-mock`).
- Changing `PUBLIC_WEB3FORMS_URL` requires a rebuild — CSP `connect-src` is pinned at build time (plan 024).

## 5. Pre-launch verification

1. `bash scripts/verify.sh` green (build + harness + project contract).
2. Deploy a **preview** build; verify:
   - `/audit` full six-step journey with the real Turnstile widget;
   - a real submission lands in the founder inbox as a **Web3Forms email**
     (check spam too; the access key's inbox is the lead destination);
   - `/api/events` returns 204 with the binding configured.
3. Then deploy production and re-verify once with a real submission.
