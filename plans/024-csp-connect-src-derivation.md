# Plan 024: Derive CSP connect-src from the Web3Forms URL instead of hard-coding it

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e33265..HEAD -- public/_headers src/pages/audit.astro .env.example scripts/build-image-manifest.mjs astro.config.mjs`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (parallel with 020-023, but note 021's receipt change may want to echo the same origin)
- **Category**: correctness / DX
- **Planned at**: commit `3e33265`, 2026-08-21
- **Issue**: —

## Why this matters

`PUBLIC_WEB3FORMS_URL` exists to allow local overrides (`http://localhost:8788` via `scripts/slice2-test-server.mjs --mode`) and a future provider switch, but `public/_headers:54` hard-codes `connect-src ... https://api.web3forms.com ...`. Any override is blocked by CSP with no diagnostic in tests — the next engineer will waste an hour on a silent `fetch` failure. Build-time derivation (or a narrow, documented allow-list) keeps the header and the code in sync with zero runtime cost.

## Current state

Relevant files:
- `public/_headers` — CSP, HSTS, caching (54-56 `connect-src` + `frame-src`)
- `src/pages/audit.astro:29` — `PUBLIC_WEB3FORMS_URL ?? "https://api.web3forms.com/submit"`
- `.env.example` — `PUBLIC_WEB3FORMS_URL=` (empty by default)
- `scripts/slice2-test-server.mjs` — local test server (accepts `--port`, `--mode ok|web3forms-down|turnstile-fail`)

Excerpt — `public/_headers:48-56` as of `3e33265`:

```
# Baseline security headers + a pragmatic CSP for a static Astro site:
# - HSTS pins HTTPS (1-year max-age, includeSubDomains) and the CSP forces
#   plaintext requests up to HTTPS, closing the SSL-strip window on the lead form;
# - 'unsafe-inline' script-src covers the no-flash theme snippet
#   (accepted plan note: no inline-script ban on the theme snippet);
# - Turnstile (challenges.cloudflare.com) loads only on /audit;
# - Cloudflare Web Analytics beacon is async and non-blocking.
# - form-action 'self': the audit form posts via fetch, never a form action.
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://static.cloudflareinsights.com; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://api.web3forms.com https://cloudflareinsights.com https://static.cloudflareinsights.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Excerpt — `src/pages/audit.astro:28-30`:

```ts
const web3formsUrl = import.meta.env.PUBLIC_WEB3FORMS_URL ?? "https://api.web3forms.com/submit";
```

Repo conventions:
- `public/_headers` is static — Cloudflare Pages reads it verbatim; no templating. The only build-time codegen in the repo is `scripts/build-image-manifest.mjs` → `src/generated/image-manifest.ts` (see `package.json: prebuild`). Follow that pattern if you add derivation.
- `scripts/slice2-test-server.mjs` is the local Web3Forms override consumer — test with it when you change CSP.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run check` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | 19 pages |
| Headers lint | `grep "connect-src" public/_headers` | shows derived or documented origins |
| Local override smoke | `node scripts/slice2-test-server.mjs --port 8788` + `PUBLIC_WEB3FORMS_URL=http://localhost:8788 npm run dev` | CSP allows localhost (manual check) |

## Scope

**In scope** (only files you should modify):
- `public/_headers` — derive or document `connect-src` origins
- `scripts/generate-headers.mjs` (create) or `scripts/build-image-manifest.mjs` (extend) — if you choose build-time derivation
- `astro.config.mjs` — if you choose to emit headers via `vite` plugin instead
- `.env.example` — clarify override scope + CSP implication
- `docs/ops/setup-checklist.md` — note that changing `PUBLIC_WEB3FORMS_URL` requires a header change / rebuild

**Out of scope** (do NOT touch):
- `src/scripts/audit.ts` delivery logic (plan 021/023)
- `functions/api/audit.ts` / `functions/api/events.ts`
- Any new `connect-src` wildcard (`*`, `https:`) — keep the allow-list narrow

## Git workflow

- Branch: `advisor/024-csp-connect-src-derivation`
- Commit per step; conventional commits
- Do NOT push or open PR unless operator instructed

## Steps

### Step 1: Choose the derivation strategy (document the decision in the plan file's comment)

Two accepted options — pick **one** (recommend Option A for minimal churn):

**Option A — Comment + checklist (no codegen, 5 minutes):** Keep `public/_headers` static, but add a machine-checkable comment and a structural test:
```text
# CSP connect-src: when PUBLIC_WEB3FORMS_URL changes, update this origin too.
# Default: https://api.web3forms.com (see .env.example PUBLIC_WEB3FORMS_URL).
connect-src 'self' https://challenges.cloudflare.com https://api.web3forms.com https://cloudflareinsights.com https://static.cloudflareinsights.com
```
Then add a check in `tests/project-contract.test.mjs` or `tests/structural.test.mjs` that `public/_headers` `connect-src` includes the origin derived from `PUBLIC_WEB3FORMS_URL` fallback (`https://api.web3forms.com`) — fails if someone changes the env default but not the header. Least code, explicit.

**Option B — Build-time header generation (robust, 30 minutes):** Create `scripts/generate-headers.mjs` that reads `process.env.PUBLIC_WEB3FORMS_URL` (or fallback `https://api.web3forms.com/submit` → origin `https://api.web3forms.com`), injects it into the CSP template, and writes `public/_headers` (or `dist/_headers` if you prefer to keep `public/_headers` as template `public/_headers.template`). Wire it into `package.json: prebuild` alongside `scripts/build-image-manifest.mjs`. Keep `https://api.web3forms.com` as default when env is empty so `npm run build` with no env still pins the default.

Do NOT choose a third option that parses `_headers` at runtime — Pages serves it static.

Record your choice in a comment at the top of `public/_headers` or `scripts/generate-headers.mjs`.

**Verify**: `npm run check` → exit 0

### Step 2: Update `public/_headers` (or the generator)

If **Option A**: add the comment above the `Content-Security-Policy` line; no origin change. Example diff:
```diff
-  Content-Security-Policy: ... connect-src 'self' https://challenges.cloudflare.com https://api.web3forms.com ...
+  # CSP connect-src must include the PUBLIC_WEB3FORMS_URL origin (plan 024) — update this when the env changes.
+  Content-Security-Policy: ... connect-src 'self' https://challenges.cloudflare.com https://api.web3forms.com ...
```

If **Option B**: implement the generator. Sketch:
```mjs
import { readFileSync, writeFileSync } from "node:fs";
const fallback = "https://api.web3forms.com/submit";
const raw = process.env.PUBLIC_WEB3FORMS_URL || fallback;
const origin = new URL(raw).origin; // e.g. https://api.web3forms.com or http://localhost:8788
const template = readFileSync("public/_headers.template", "utf8");
const headers = template.replace("{{WEB3FORMS_ORIGIN}}", origin);
writeFileSync("public/_headers", headers); // or dist/_headers if template lives in public
```

For local dev, keep `http://localhost:8788` out of production headers — only inject when `PUBLIC_WEB3FORMS_URL` is set at build time to a localhost origin. A production build with no env must emit `https://api.web3forms.com` regardless of local `.env`. Document this.

**Verify**: `npm run build` → 19 pages; `grep connect-src public/_headers` shows the expected origin

### Step 3: Update docs

1. `.env.example` — after `PUBLIC_WEB3FORMS_URL=` line, add:
   ```
   # If you change PUBLIC_WEB3FORMS_URL, rebuild so CSP connect-src stays in sync (see public/_headers / plan 024).
   ```

2. `docs/ops/setup-checklist.md` — add one line under Web3Forms / Turnstile setup: "Changing `PUBLIC_WEB3FORMS_URL` requires a rebuild — CSP `connect-src` is pinned at build time (plan 024)."

**Verify**: `bash scripts/project-verify.sh` (if exists) → no doc contract failures

### Step 4: Add a structural pin so drift becomes a build failure

Add a test or extend `tests/structural.test.mjs` (or `tests/project-contract.test.mjs` if it owns env checks):

```ts
test("CSP connect-src includes the Web3Forms origin (plan 024)", () => {
  const headers = fs.readFileSync("public/_headers", "utf8");
  const fallback = "https://api.web3forms.com";
  const envOrigin = process.env.PUBLIC_WEB3FORMS_URL ? new URL(process.env.PUBLIC_WEB3FORMS_URL).origin : fallback;
  assert.ok(headers.includes(envOrigin), `public/_headers connect-src must include ${envOrigin}`);
  assert.ok(!headers.includes("connect-src *") && !headers.includes("connect-src https:"), "connect-src must not contain wildcards");
});
```

If you chose Option A (comment-only), the test asserts the fallback origin is present — catches header drift. If Option B (generator), the test asserts the generator's output matches the env.

**Verify**: `npm test` → new test passes; `npm test` still green with `PUBLIC_WEB3FORMS_URL=http://localhost:8788 npm test` (if Option B, test should see localhost origin and pass)

## Test plan

- New structural test `CSP connect-src includes the Web3Forms origin` — fails if header and env diverge.
- Manual (if Option B): `PUBLIC_WEB3FORMS_URL=http://localhost:8788 npm run build && grep connect-src public/_headers` → shows `http://localhost:8788` in prod build only when env set.
- Regression: `npm test` all pass, `npm run build` 19 pages.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0; new CSP pin test exists and passes
- [ ] `grep connect-src public/_headers` shows `https://api.web3forms.com` (fallback) when no env, and no `*` / `https:` wildcard
- [ ] `grep PUBLIC_WEB3FORMS_URL .env.example` doc line exists
- [ ] No files outside in-scope list modified (`git status`)

## STOP conditions

Stop and report (do not improvise) if:

- `public/_headers` is not served verbatim by Pages (e.g., project uses `dist/_headers` override) — header generation path is wrong
- `scripts/build-image-manifest.mjs` prebuild hook order matters and your generator races it — check `package.json: prebuild` and run both
- `PUBLIC_WEB3FORMS_URL` at build time contains a non-https origin in production (e.g., `http://…`) — flag and ask; production CSP should not allow `http:` except for localhost dev
- The project already has a header templating system you missed — search `public/_headers*` and `_headers.template`

## Maintenance notes

- Reviewer should check that a production build with **no** env still emits `https://api.web3forms.com` — local `.env` must not leak into the prod header.
- Future provider switch (Resend, Email Workers — `D-01`) will remove the Web3Forms origin entirely — delete the CSP entry in the same change, not separately.
- Keep the `connect-src` list narrow — adding `https://*.web3forms.com` would over-broaden; pin the single origin.
