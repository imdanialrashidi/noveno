# Noveno Launch — Founder Setup Checklist

The site is a **static Astro build on GitHub Pages**. There is no server,
no database, no Cloudflare, and no server-side secret. The only thing to
provision is the **Web3Forms access key** that delivers audit leads by email.

A `git push` to `main` runs the quality gate and, when it passes, builds and
deploys `dist/` to GitHub Pages. A failed gate deploys nothing (that is how
the 2026-10 freeze happened — see `docs/ops/runbook.md`).

## 1. Web3Forms (lead email delivery — the sole lead destination)

1. Create an access key at <https://web3forms.com> for the founder inbox.
2. Add it as an Actions **repository variable** (not a secret — it is public
   by design and ships in the built JavaScript):
   **Settings → Secrets and variables → Actions → Variables →**
   `PUBLIC_WEB3FORMS_ACCESS_KEY`.
3. For local builds copy `.env.example` to `.env` and set the same name.

**Security note:** the key is public. Anyone who extracts it can POST directly
to Web3Forms, bypassing the form's honeypot. Web3Forms spam filtering plus
human review of the inbox are the only controls. Rotate the key in the
dashboard and update the repository variable if the inbox is abused.

## 2. GitHub Pages (hosting)

1. **Settings → Pages → Source: GitHub Actions.**
2. Custom domain `noveno.ir`:
   - `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153`
   - `www` → `CNAME` → `imdanialrashidi.github.io`
3. **Settings → Pages → Enforce HTTPS** (the certificate is managed by GitHub;
   without this, `http://noveno.ir` serves the site too).
4. **Settings → Actions → Variables:** `PUBLIC_WEB3FORMS_ACCESS_KEY`.
   `PUBLIC_APP_URL` is pinned to `https://noveno.ir` in the workflow.
5. Node version comes from `.node-version` (22.23.2); do not set a conflicting
   `NODE_VERSION` variable.

## 3. Local development

```bash
cp .env.example .env        # add PUBLIC_WEB3FORMS_ACCESS_KEY
npm ci
npm run dev                 # UI at http://localhost:4321
```

- The form posts to the real Web3Forms endpoint; a local submission sends a
  real email unless `PUBLIC_WEB3FORMS_URL` points at a mock.
- Preview the production build with `npm run build && npm run preview`.

## 4. Pre-launch verification

1. `bash scripts/verify.sh` green (build + workflow checks + contract + tests).
2. Push to `main`; confirm the `quality` workflow's **deploy** job succeeded.
3. Open `https://noveno.ir` and submit one real request end to end:
   the thank-you page must appear **and** the email must arrive (check spam).
4. Check `https://noveno.ir/work/gym-log/` (a recent route) to confirm the
   deploy is fresh rather than a cached older artifact.
5. Mobile pass on `/` and `/audit`.

## 5. Known limits of GitHub Pages

- **No custom response headers:** no CSP, HSTS, `X-Frame-Options`, or
  immutable cache headers. `.nojekyll`/`_headers` style files are not used.
- **No 301 redirects:** legacy `/insights/*` links are forwarded to `/blog/*`
  by the built `404.html` (crawlers see a 404).
- **No analytics ingest:** `src/scripts/analytics.ts` has an empty
  `EVENT_URL`, so events stay in the browser. UTM/referrer attribution still
  travels in the lead email.
- **No server trust boundary:** validation is client-side only.
