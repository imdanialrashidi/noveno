# Noveno Launch — Founder Setup Checklist (Slice 2)

Provisioning steps for production readiness. **No deployment is executed from
this repository** — this checklist prepares the accounts so a single
`git push` to `main` + a Pages production deploy can go live.

## 1. Supabase (lead source of truth)

1. Create a free project at <https://supabase.com> (name: `noveno`).
2. Open **SQL Editor** and run `supabase/migrations/20260811120000_leads.sql`.
   - Creates `public.leads` with a unique `submission_id`, RLS enabled,
     **zero policies** (no public read/write — by design).
3. Project Settings → API:
   - Copy **Project URL** → `SUPABASE_URL`.
   - Copy **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
     (server-only; never in the repo, never in the browser).
   - The **anon/public key is intentionally NOT used** anywhere.
4. Before first production submission, take a backup (Dashboard → Database →
   Backups, or `supabase db dump`). Lead data is business-critical.

## 2. Cloudflare Turnstile (anti-abuse)

1. Dashboard → Turnstile → Add site (domain: your Pages domain, e.g.
   `noveno.ir`; widget mode: managed/managed-non-interactive).
2. Copy **Site Key** → `PUBLIC_TURNSTILE_SITE_KEY` (public, build-time).
3. Copy **Secret Key** → `TURNSTILE_SECRET_KEY` (Pages secret, server-only).
4. Local testing without a real key: official test keys
   (`1x00000000000000000000AA` sitekey / `1x0000000000000000000000000000000AA`
   secret) — they work on localhost; **never configure them in production**.

## 3. Web3Forms (founder email notification — best-effort only)

1. Create an access key at <https://web3forms.com> (free; email to the
   founder inbox).
2. Copy the **Access Key** → `PUBLIC_WEB3FORMS_ACCESS_KEY` (public by design;
   Web3Forms posts happen client-side after the function confirms
   persistence).
3. Notification is convenience only. **Supabase is the source of truth** —
   email failure never loses a lead and never blocks the visitor.

## 4. Cloudflare Pages (hosting + functions + analytics)

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
   - **Secrets (encrypted, server-only):** `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`.
4. **Analytics Engine binding:** create dataset `noveno_events` (Dashboard →
   Analytics Engine) and bind it as `NOVENO_EVENTS` on the Pages project
   (Settings → Functions → Bindings → Analytics Engine). The events endpoint
   degrades to 501 until the binding exists — the site keeps working.
5. Optional: Cloudflare Web Analytics site → token → `PUBLIC_CF_ANALYTICS_TOKEN`.

## 5. Local development

```bash
cp .env.example .env          # fill PUBLIC_* test values (names only in git)
cp .env.example .dev.vars     # fill SUPABASE_*/TURNSTILE secret values locally
npm install
npm run dev                   # UI at http://localhost:4321
npx wrangler pages dev dist   # functions + built site (reads .dev.vars)
```

- Use the official Turnstile **test keys** locally.
- Analytics Engine is not available in `wrangler pages dev` → `/api/events`
  returns 501; the client ignores it. Verify events on a preview deploy.
- For a full local journey against a real Supabase, point `.dev.vars` at the
  staging project and use marker rows (cleanup after).

## 6. Pre-launch verification

1. `bash scripts/verify.sh` green (build + harness + project contract).
2. Deploy a **preview** build; verify:
   - `/audit` full six-step journey with the real Turnstile widget;
   - a real submission lands in Supabase (one row per `submission_id`);
   - duplicate replay of the same submission does not create a second row;
   - founder email arrives (Web3Forms) — if not, check the inbox/spam and the
     access key, **the lead is still safe in Supabase**;
   - `/api/events` returns 204 with the binding configured.
3. Then deploy production and re-verify once with a real submission.
