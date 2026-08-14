# Noveno Launch — Durable Execution Plan

Status: active — **Slice 1 complete (2026-08-11)**; **Slice 2 complete (2026-08-11)**; **visual redesign complete (2026-08-14, founder-directed)**; launch awaiting founder provisioning + deploy.
Updated: 2026-08-14

> **Founder override (2026-08-14, second review): the flowchart/route visual language is removed from the public design.** The Journey Line / route-band / station-rail grammar (JourneyLine, BeforeAfterJourney, ChannelMap, LeadStatusStrip, SystemArchitectureDiagram, ProofRow, scatter fields, StepperLine station rail, footer mini route, 404 route motif, dashed wireframe concept previews, line-style ProofTag codes, section node markers) is **rejected as a visual concept** and must not be reintroduced. The accepted replacement is the image-led editorial system — Typography + Photography + Real Product Screens + Editorial Numbers — recorded in `docs/DESIGN.md` §3 (thesis), §4 (signature), §9 (media), §15 (screen matrix), §16 (decision log). The word «مسیر» survives only as product copy (fixed CTA «درخواست بررسی مسیر جذب»), never as a drawn route. All acceptance criteria and in-scope items below that name the old grammar are superseded by the 2026-08-14 thesis; audit progress is «مرحله X از ۶» + progress bar, thank-you is a numbered next-steps sequence, work previews are large real screenshots (projects) and labeled designed mocks (concepts).
Source of truth: `AGENTS.md` (order of precedence), `docs/DESIGN.md` (visual contract), `docs/PRODUCT.md` (product contract), `docs/ARCHITECTURE.md` (invariants), `docs/QUALITY.md` (quality contract), Master Spec v1.0 (full reference), `docs/PLAN.md` (roadmap).
Use: `/resume docs/exec-plans/active/noveno-launch.md` for any fresh context that continues this work.

## Slice 2 evidence (recorded at completion)

- **Delivered:** `/audit` + `/audit/thank-you` on the Slice 1 design system (six stations, StepperLine client-driven states, chips with RTL arrow-key navigation, per-field/step/form validation, submitting state, retry banner with values preserved, offline banner with contact fallback, aria-live progress + announcements, Turnstile explicit render in the contact station with theme sync + reset-on-retry); framework-free state machine (`src/scripts/audit.ts`: sessionStorage draft `noveno:audit:draft`, stable `submission_id`, attribution from the session capture `noveno:attribution`); `functions/api/audit.ts` trust boundary (size limit → JSON → honeypot → whitelist validation + Persian-digit normalization → per-isolate rate limiter → Turnstile siteverify with remoteip + idempotency_key → idempotent Supabase upsert `onConflict submission_id ignoreDuplicates` + replay re-select → 200/400/403/429/502/413/405); `functions/api/events.ts` + `src/scripts/analytics.ts` (queue + sendBeacon, declarative `data-event` wiring, Analytics Engine `NOVENO_EVENTS`, 501-degraded, no PII); Web3Forms client notification gated behind 200 (≤2.5s race, one retry, never blocks thank-you); Supabase migration (RLS on, zero policies, unique `submission_id`); `CTA_URL` flipped to `/audit`; sitemap/robots/_headers/JSON-LD/og.png (1200×630); `.env.example` names-only extension; docs/ops setup checklist + runbook; `scripts/slice2-test-server.mjs` deterministic test server (mock PostgREST + mock Web3Forms + recording Analytics Engine).
- **Verification:** `npm run check` 0 errors; `npm test` 120/120 (incl. 50+ audit-function trust-boundary tests: normalization, enums, rate limiter, Turnstile fake+REAL siteverify with official test keys against challenges.cloudflare.com, request-level invariant ordering, HTTP-level persistence through the real supabase-js client against an in-process mock PostgREST incl. replay + parallel race + wire-shape assertions, events endpoint incl. flood rate-limit, migration contract incl. `.dev.vars` gitignore, sitemap/robots/headers/JSON-LD/og.png/honeypot/guard-script, CTA flip, client↔server enum drift guard); `bash scripts/verify.sh` exit 0 (120/120, pi-doctor + project contract green) from a clean checkout at f1067f1; browser matrix at 1440/390/320 + both themes: full journey ×4 (incl. one with UTM attribution → lead row), reload-mid-journey restore, validation states (incl. aria-describedby linkage), network-failure banner + retry with values preserved, offline banner, Turnstile rejection (always-fail secret → 403, nothing persisted), Supabase failure (502 → recovery retry), Web3Forms failure (2 attempts, thank-you + lead intact), duplicate replay → single row, thank-you guard (submit path hidden pre-paint + direct-visit visible, CLS ≤ 0.0003 both paths), keyboard/aria snapshot, lab LCP 312ms/192ms + CLS 0.001/0.002 (/audit 1440/320) — screenshots under `.artifacts/playwright/slice2/`.
- **Independent review (2026-08-13):** `security-auditor` PASS WITH FIXES — all findings fixed and regression-tested (honeypot field now rendered+echoed; events endpoint rate-limited 60/min/IP; `.dev.vars` gitignored; strict-ISO `first_seen_at`; rate gate moved before parsing; Web3Forms payload HTML-stripped; channel dedupe). `reviewer` PASS WITH FIXES — MAJOR (PageLayout head-slot forwarding for the thank-you guard script) and all MINORs fixed and browser-re-verified (aria-describedby linkage, submit catch-guard, 400→validation banner copy, Turnstile script-load retry, AbortSignal timeout, focus only on step change, single live region, mock wire-shape assertions, PUBLIC_APP_URL consumed, docs updated).
- **UNPROVEN (external, no credentials in this environment):** live Supabase project persistence (proven through real supabase-js + mock PostgREST at HTTP level; schema contract tested); real Web3Forms email delivery (mock endpoint exercised); deployed Analytics Engine writes (binding unavailable locally; 501-degraded path proven); appearance-dependent craft criteria (no image vision — screenshots archived for human review); field CWV (lab only).
- **Slice 2 exit = ready for independent /design-review after founder provisioning (docs/ops/setup-checklist.md) and one preview-deploy smoke.**

---

## Slice 1 evidence (recorded at completion)

- **Delivered:** Astro 7.2 + TS strict + Tailwind v4 static app at repo root; all 10 Slice 1 routes (`/`, `/services`, `/work`, `/work/[slug]`, `/process`, `/about`, `/contact`, `/privacy`, `/terms`, `/404`); token/theme layer with both themes, no-flash init, persisted override, accessible toggle; Estedad+Vazirmatn self-hosted fonts (165 KB ≤ 200 KB budget); Journey Line grammar (JourneyLine, BeforeAfterJourney, ChannelMap, LeadStatusStrip, SystemArchitectureDiagram, ProofRow, StepperLine, NextStepsRail); content layer with truthful work schema + launch content (1 real project: the site itself; 2 labeled concepts; 0 fabricated case studies); `CTA_URL=/contact`; metadata foundation per page.
- **Verification:** `astro check` 0 errors; `npm test` 50/50 (incl. structural + content honesty tests); `scripts/verify.sh` exit 0; browser matrix exercised at 1440/390/320, both themes, keyboard/focus/a11y snapshot, reduced-motion CSS guard, pixel-sampled theme/diagram evidence; screenshot artifacts under `.artifacts/playwright/` (provenance: route, viewport, theme); reviewer studio pass #1 → fixes applied (theme-toggle aria-label, hero diagram label scale via dual SVG compositions, Persian digits, tracking, CTA label, a11y dedup, 404 decision logged in DESIGN §17) → reviewer pass #2 (README WITH FIXES: phantom system-map node + label floors) → final fixes verified in browser (station counts derived from data, mobile labels ≥12px at 390, no phantom nodes, `astro check`/tests/gate re-green).
- **Known limitations:** appearance-dependent aesthetic criteria marked UNPROVEN where the evaluator has no image vision (screenshots archived for human review); case-study long-content state (DESIGN §15 screen 6) unprovable until real case-study content exists; hero diagram labels at 320px render ≈ 9.6px (design minimum 390px; reflow requirement met).
- **Slice 2 consumes:** component inventory (incl. StepperLine, FormField/Select/MultiSelect/Textarea to build), `src/data/site.ts` (AUDIT_STATIONS, CTA_URL flip), work collection, fonts/theme baseline, verification routes + CI app job.
- **Docs updated during build (recorded decisions):** DESIGN §17 decision log — 404 error-state route language (sixth place), JourneyLine as CSS flex route, dual-SVG diagram compositions for label scale, compact header CTA variant.

---

## 1. Goal and explicit non-goals

**Goal.** Launch the Noveno production website in exactly two coherent implementation slices — (1) the flagship public site with the accepted «مسیر» design system, and (2) the acquisition flow and production integration — on the accepted stack (Astro + TypeScript, static, Tailwind, Persian-first/RTL, Cloudflare Pages + one narrowly scoped Pages Function project, Supabase source of truth, Web3Forms notification, Turnstile anti-abuse, Cloudflare analytics), with every trust boundary, integration, and verification expectation resolved at plan level so implementation does not rediscover architecture or sequencing.

**Non-goals (do not reopen).**
- No implementation during `/plan`; no redesign of the accepted visual direction (`docs/DESIGN.md` is the contract, not a suggestion).
- No client UI framework (no React/Vue/Svelte); no SSR; no adapter-driven server output.
- No authentication, CMS, custom CRM UI, client portal, dashboard, payment system, blog, industry pages, or speculative infrastructure.
- No additional implementation slices for organizational neatness; no per-page task splitting.
- No fabricated business content or proof; metrics only with evidence (Spec §19, §21.7–21.8).
- No deployment during this stage; deployment readiness is documented, not executed.
- No spending or new paid services: everything resolved below is free-tier compatible.

## 2. Acceptance contract (observable criteria + proof)

- **A1 — Two-slice boundary is safe and explicit.** The accepted launch scope (Spec §73) maps into exactly two slices; no repository constraint forces a third. — proof: this plan's slice boundaries; `docs/DESIGN.md` screen matrix maps 1–7, 10–12 → Slice 1 and 8–9 → Slice 2; reviewer check of the mapping.
- **A2 — Slice 1 is one coherent flagship site (2026-08-14: visual system = image-led editorial; the Journey Line grammar was removed by founder override).** All Slice 1 pages render fa + RTL with the accepted tokens, typography, photography/media figures, light/dark themes, responsive recompositions, and accessible shell — reviewable as a single site, not scaffolding. — proof: browser-qa screenshots/accessibility snapshots for DESIGN matrix screens 1–7 and 10–12 (desktop 1440 + mobile 390, both themes), reduced-motion variant, `frontend-design` flagship gates (avg ≥ 3.25, no dimension < 3), full gate green.
- **A3 — Slice 2 delivers the audit journey per DESIGN §11 (2026-08-14: progress = «مرحله X از ۶» + clean bar; thank-you = numbered next steps + contact fallback; the station rail and extended route were removed by founder override).** Six-step framework-free flow with validation, submitting, error/retry (values preserved), offline banner. — proof: full browser journey (matrix screens 8–9), error-state screenshots, keyboard + aria snapshot, 320px reflow.
- **A4 — Trust invariants hold.** (i) A successful submission is only ever presented after Supabase persistence succeeds; (ii) a failed Supabase persistence is never presented as success; (iii) an accepted lead is never lost merely because email notification fails. — proof: defect-sensitive function tests + staging integration exercising simulated Supabase failure and simulated Web3Forms failure.
- **A5 — Duplicate/idempotency protection.** Replaying the same `submission_id` (double-submit, retry after timeout) yields exactly one lead row and a truthful success response. — proof: integration test with duplicate `submission_id`; unique index evidence.
- **A6 — Attribution preserved with the lead, independent of analytics.** UTM/referrer/landing page/first-seen persisted on the lead row. — proof: staging submission with crafted UTM params → row inspection; analytics outage simulation does not affect the payload.
- **A7 — Static-first and hygiene verified mechanically.** No client-framework dependencies; `fa` + `dir="rtl"` on every built page; fonts ≤ 200 KB woff2; interactive JS ≤ 15 KB gzip; no secrets in repo; `.env.example` documents names only. — proof: structural tests over built HTML + dependency assertion, build output inspection, lab measurement, `scripts/project-verify.sh` + secret scan green, reviewer.

## 3. Confirmed facts, constraints, assumptions, unknowns

### Confirmed repository state
- Bootstrap + `/design` complete; **no application code exists**. Docs are the accepted contracts; `branding_assests/` holds the logo SVGs (legacy purple fill, embedded Tahoma «NOVENO» in `Logo_Website_SVG.svg`).
- Verification system: `.pi/verification.json` routes, `scripts/verify-affected.mjs`, `scripts/verify.sh` (pi-doctor + project-contract), `node --test tests/*.test.mjs`, CI `.github/workflows/quality.yml` (Node 22.23.2). README promises `src/**` evidence routes once the app lands.
- Env contract today: `.env.example` contains only `APP_ENV=development`. Node ≥ 22.19 pinned.
- DESIGN.md records measured font sizes (≈165 KB total, 2026-08-11) and verified AA token contrast; anchors `#679e86`/`#619881` are mechanically asserted by `check-project-contract.mjs`.

### External facts verified against current official sources (2026-08-11)
| Area | Verified fact | Source |
|---|---|---|
| Astro | Latest `astro@7.2.0`; static output is default; Content Layer API = `src/content.config.ts` + `defineCollection` + `glob` loader + zod schema; no adapter needed for a static site with a Pages `functions/` directory | npm registry; Astro docs |
| Cloudflare Pages | `functions/` dir at project root; `pages_build_output_dir` (default `./dist`); `compatibility_flags: ["nodejs_compat"]` required for Node-API packages; Analytics Engine binding **is supported on Pages Functions** via `context.env` (not available in local `wrangler pages dev`); no `_routes.json` needed when only `functions/` files define routes | developers.cloudflare.com/pages |
| Web3Forms | POST `https://api.web3forms.com/submit` with `access_key` + arbitrary fields (JSON or FormData); access key is **public by design** (embedded in client HTML); response codes 200/303/400/429/500; **server-side usage requires the paid plan + server IP whitelisting**; official Astro guide posts from the browser | docs.web3forms.com (API reference, Astro guide) |
| Turnstile | Client script `https://challenges.cloudflare.com/turnstile/v0/api.js` (explicit render, callback/error-callback, `turnstile.reset`); siteverify POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` + `response` (+ optional `remoteip`, `idempotency_key`); tokens single-use, expire (~5 min) → `timeout-or-duplicate`; **official test keys** exist (always-pass sitekey `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA`, always-fail `2x…AB`, duplicate-token `3x…AA`); test keys work on localhost | developers.cloudflare.com/turnstile |
| Supabase | Server-side client with the **service-role/secret key bypasses RLS and must never ship to the browser**; protection for the `anon` role = RLS with no policies; supabase-js v2 runs in Workers (nodejs_compat) | supabase docs |
| Web Analytics | Baseline page views/visits/CWV only; **custom events: "Not yet"**; UTM query strings are **not** logged | developers.cloudflare.com/web-analytics FAQ (current) |
| Analytics Engine | Cloudflare-native time-series store; `writeDataPoint` non-blocking; free tier 5M writes/month; SQL API for queries; bindable to Pages Functions | developers.cloudflare.com |
| Zaraz | Tag manager (edge proxy), **not an event store** — custom `zaraz.track` events only persist via a configured destination; free destinations (GA4) are blocked in Iran; privacy-friendly stores (Plausible/Fathom) are paid | developers.cloudflare.com/zaraz |
| Fonts | `@fontsource-variable/estedad@5.3.0` and `@fontsource-variable/vazirmatn@5.3.0` exist on npm (SIL OFL 1.1); DESIGN.md measured subset sizes | npm registry |

### Assumptions (recorded, not verified)
- Supabase free tier and Cloudflare free tier are sufficient for launch volume (no evidence of otherwise).
- A single-founder ops model: founder reads Supabase rows + email notifications; no dashboard needed at launch.
- Launch content set: founder supplies real case studies; until then only clearly labeled concepts/projects ship (Spec §18–19 allow concepts; fabrication is not).
- `wrangler` CLI (latest v4) is an acceptable devDependency for local function testing; it is tooling, not application infrastructure.

### Material unknowns (handled, not blocking)
- Exact founder-provisioned credentials (Supabase project, Turnstile keys, Web3Forms access key, analytics token) — provisioning is a founder step documented in Slice 2; the plan requires only names, never values.
- Real case-study content availability at launch — handled by the honest empty/labeled-concept path; content is data, not code.
- supabase-js edge behavior in the Pages Functions runtime — de-risked by `nodejs_compat`; fallback is a direct PostgREST `fetch` (no API change to the function contract).

## 4. Existing contracts to reuse (do not re-derive)

- `docs/DESIGN.md` — thesis, the five-place route-language rule (§3), four Journey Line patterns + line-style proof code (§4), type roles/scale/fallbacks (§5), semantic tokens + verified contrast (§6), theme behavior (§7), composition/grid (§8), component inventory (§10), /audit treatment (§11), motion (§12), voice (§13), budgets (§14), screen-proof matrix (§15), decision log (§17).
- `docs/PRODUCT.md` — flows, acceptance, performance/a11y budgets, measurement/operations (event names, guardrails).
- `docs/ARCHITECTURE.md` — invariants, trust boundaries, chosen patterns table.
- `docs/QUALITY.md` — project invariants (RTL, no client framework, no fabricated proof, business-critical form, secrets, themes, a11y, performance, no speculative infra) + evidence hierarchy.
- Master Spec — §8.1 IA, §10 homepage sequence, §18–19 proof policy, §21 case-study template, §23 qualification, §24 process, §31–33 audit form + attribution + post-submission, §35 lead model, §36 event model, §39 pricing framing, §43 SEO, §50–51 performance/a11y, §57 component list, §61–63 reliability/security/privacy, §64 Iran resilience, §65–66 content/metrics models, §73–74 launch scope/acceptance.
- Repository workflow: `.pi/verification.json`, `scripts/verify-affected.mjs`, `scripts/verify.sh`, `scripts/check-project-contract.mjs` (markers `#679e86`, `#619881`, "Astro", "Cloudflare Pages", "Supabase", "static", "RTL", "WCAG 2.2 AA" must stay intact), `tests/*.test.mjs` conventions (node:test), browser-qa/verification-routing/test-design/frontend-design/risk-review skills.

## 5. Smallest viable architecture (resolved decisions)

### 5.1 Astro structure
- **Scaffold:** `npm create astro` (TypeScript, strict) at repo root; npm as package manager; `astro@^7`, `tailwindcss` v4 via `@tailwindcss/vite` plugin, `@astrojs/check` + `typescript` for `astro check`. No adapter. Engine `>=22.19`.
- **Layout:** `src/layouts/BaseLayout.astro` (html shell: `lang="fa" dir="rtl"`, theme init inline script, fonts, meta, analytics beacon) + `PageLayout.astro` (Header/MobileMenu/Footer/SectionHeader composition).
- **Components (2026-08-14 inventory):** `src/components/ui/` (Button, TextLink, ProofTag, FormField, Select, MultiSelect, Textarea, FAQItem, Metric), `src/components/business/` (WorkCard/WorkRow, ConceptPreview, NextStepsRail, StepperLine-as-AuditProgress, OfferRow), `src/components/layout/` (Header, MobileMenu, Footer, SectionHeader, PageHero, CTASection) — the DESIGN §10 inventory is the contract; exact file/class naming is build-agent choice.
- **Media (replaces the old diagram layer):** photography = CC0, local, captioned with provenance (`docs/IMAGERY.md`); real product screenshots = captured from the production build; concept previews = designed labeled mocks; AVIF/WebP right-sized variants, `srcset` + `width`/`height`, lazy below fold, LCP preload. No diagram image files.
- **Content:** Content Layer at `src/content.config.ts`; single `work` collection (`src/content/work/*.md`), `glob` loader, zod schema (below). No CMS.
- **Client scripts:** `src/scripts/` framework-free TS modules: `theme.ts` (inline head version only for init), `menu.ts`, `analytics.ts` (Slice 2), `audit.ts` (Slice 2), `line-draw.ts` (hero draw, optional observer). Bundled by Astro; total interactive JS ≤ 15 KB gzip.
- **Data:** `src/data/site.ts` — typed constants: nav, contact facts (09353598620, imdanialrashidi@gmail.com, Instagram @noveno.ir, WhatsApp/Telegram), three offers, FAQ, process stages, audit stations, proof entries pointer, **`CTA_URL`** (Slice 1 → `/contact`; Slice 2 flips to `/audit`), **`HERO_HEADLINE`** (one of the two approved candidates — single-line swap).
- **Pages:** `src/pages/` → `/`, `/services`, `/work`, `/work/[slug]`, `/process`, `/about`, `/contact`, `/privacy`, `/terms`, `/404.astro` (Slice 1); `/audit`, `/audit/thank-you` (Slice 2). Metadata foundation per page in Slice 1; sitemap/robots/structured-data completion in Slice 2.
- **Functions:** `functions/api/audit.ts` and `functions/api/events.ts` at project root (Pages Functions; routes `/api/audit`, `/api/events`). `wrangler.jsonc` committed with `pages_build_output_dir = "./dist"`, `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, and the `NOVENO_EVENTS` Analytics Engine binding (name only). Local dev: `astro dev` for UI; `wrangler pages dev` for function+site integration. `.dev.vars` (gitignored) for local secrets.
- **Package/tooling boundary:** `@supabase/supabase-js` (Slice 2, function scope), `wrangler` (devDep), `@cloudflare/workers-types` (devDep, for `PagesFunction` typing). No other runtime dependencies. No client framework — enforced by dependency assertion test + build output inspection.

### 5.2 Content model (work collection)
Zod schema, `type` discriminated union:
```ts
type: 'case-study' | 'project' | 'concept'          // Spec §18, DESIGN §4.3
title, slug (derived), industry, summary, published_at
client: { name, public: boolean }                    // client_public guard
timeline?, scope?, problem?, solution?
components: string[]                                 // Spec §22 vocabulary
metrics?: { name, value, unit?, period?, baseline?, source, verified, note? }[]  // Spec §66
limitations?: string[]                               // §21.8 mandatory when interpretation is constrained
gallery?: image[]                                   // real screenshots only, labeled «نمونه رابط سیستم» when fictional
featured?: boolean
```
Rendering rules (mechanical): `case-study` → ProofTag «مطالعه موردی» + solid line/filled squares + metrics with source+limitation footnotes; `project` → «پروژه» + solid/hollow + honest «نتیجه: در دست اندازهگیری/نامشخص»; `concept` → dashed line + «نمونه نمایشی — سناریوی مفهومی» + «هدف طراحی»/«KPI پیشنهادی» language. **Missing content is safe:** `/work` renders an honest curated list or a designed empty state; optional fields use schema defaults + component guards; never fabricate entries, testimonials, logos, or numbers.

### 5.3 Theme, typography, Journey Line
- Fonts: import `@fontsource-variable/estedad` + `@fontsource-variable/vazirmatn`; copy **arabic + latin** subsets to `public/fonts/` (skip latin-ext/vietnamese; total ≤ 200 KB per DESIGN §5.4); `@font-face` with `font-display: swap`; metric-matched local fallback faces (Tahoma) behind webfonts (CLS-safe); **preload only `estedad-arabic`**; `Cache-Control: immutable` for `/fonts/*` via Pages `_headers` (Slice 2 hardening).
- Theme: CSS custom properties per DESIGN §6 on `:root` (light) + `[data-theme="dark"]`; `@media (prefers-color-scheme: dark)` default wiring; inline ≈0.4 KB head script reads `localStorage['noveno-theme']` (values `light`/`dark` only, **never writes the OS default**) and sets `data-theme` before first paint; `<meta name="color-scheme" content="light dark">` + CSS `color-scheme`; accessible toggle `<button aria-pressed>` in header + mobile menu (label «حالت روشن / حالت تاریک», ≥44px); transitions ≤150 ms, none under `prefers-reduced-motion`.
- Journey Line: five-place rule from DESIGN §3 (hero, system model, process, audit progress, proof line codes) + square section-header node marker; geometry rules §4.2; line-style proof code §4.3 — solid = real, dashed = demo, hollow = unverified outcome; label/line, never color alone.
- Tailwind: v4 CSS-first config; tokens mapped from DESIGN §6 as theme values; component-local colors forbidden (token-only); build-agent choice on exact `@theme` mechanics.

### 5.4 Audit state machine (Slice 2, framework-free)
- One TS module (`src/scripts/audit.ts`), no state library. Step data in a typed `AuditDraft`; **persisted to `sessionStorage` (`noveno:audit:draft`) on every step change and restored on load** (reload-safe journey); cleared on successful submission.
- `submission_id = crypto.randomUUID()` generated when the journey starts (first step interaction), **stable across retries**; a genuinely new journey gets a new id.
- Attribution captured at journey start into the draft: `landing_page` (pathname+search), `referrer`, `utm_*` params, `first_seen_at` (ISO) — preserved independently of analytics availability; sent with the submission.
- Validation: per-field inline on blur/touch, step-level check, form-level summary on submit; `aria-describedby` linkage; **client validation is UX-only — the function is authoritative**.
- Turnstile: explicit render in the form card (managed/non-interactive widget; theme follows site theme); token required before submit; on retry after a consumed/expired token, `turnstile.reset()` and wait for a fresh callback.
- Submit flow: disable + inline progress («در حال ارسال…») → POST `/api/audit` → on 200: fire Web3Forms notification (below), navigate to `/audit/thank-you` → on recoverable error: banner «ارسال نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید» + «تلاش دوباره», **field values preserved**; offline (`navigator.onLine`) shows the same banner with the contact fallback emphasized (DESIGN §11).
- Retry semantics: same `submission_id`, fresh Turnstile token; server dedupes (A5).

### 5.5 Submission trust boundary (`functions/api/audit.ts`)
**Responsibilities (and nothing else):** parse + size-limit the body (≤ ~32 KB); server-side field validation (enums whitelisted, lengths capped, phone normalized **Persian digits → Latin**, email format when present, required-field completeness); honeypot check if present; Turnstile **siteverify (mandatory)** with `remoteip` + `idempotency_key = submission_id`; per-IP in-memory rate limit (small sliding window, isolate-local — documented limitation, Turnstile is the primary gate); Supabase insert with `onConflict('submission_id')` + `ignoreDuplicates`; return contract below. **No Web3Forms call from the function** (official docs: server-side usage requires paid plan + IP whitelisting — see §9 risk R1). Never log lead content (fields, phone, attribution); log only outcome codes + `submission_id`.

**Request/response contract (public):**
```
POST /api/audit  (application/json)
{ submission_id, name, phone, email?, preferred_contact, business_name?, industry, website?,
  acquisition_channels: string[], primary_problem, requested_service, customer_value_range?,
  cf_turnstile_token, attribution: { landing_page, referrer, utm_source?, utm_medium?,
  utm_campaign?, utm_content?, utm_term?, first_seen_at } }

200 { ok: true, id }                       // persisted (or idempotent replay of same submission_id)
400 { ok: false, error: { code: 'validation', fields: { field: messageKey } } }
403 { ok: false, error: { code: 'turnstile_failed' } }
429 { ok: false, error: { code: 'rate_limited' } }
502 { ok: false, error: { code: 'persistence_failed' } }   // Supabase failure — NEVER 200
413 / 405 / 500  — body-too-large, method, generic
```
Client maps codes to the DESIGN §11 Persian copy; 502 always yields the retry banner with values preserved. Invariant: 200 is only reachable after Supabase accepts the row (fresh or idempotent-replay).

### 5.6 Web3Forms notification (client-side, gated behind function success)
- After `/api/audit` returns 200, the client POSTs the notification to `https://api.web3forms.com/submit` (JSON): `access_key` (public by design; `PUBLIC_WEB3FORMS_ACCESS_KEY`), `subject` («درخواست بررسی مسیر جذب — {business|name}»), all normalized fields + attribution + `submission_id` for traceability.
- `fetch(..., { keepalive: true })`, awaited via `Promise.race` with a short timeout (≈2.5 s), **one automatic retry**; then navigate to thank-you regardless of outcome. Notification success/failure never changes the prospect's success experience and never affects the lead record (Supabase is the source of truth).
- **Failure semantics:** notification failure = founder email missed, lead intact in Supabase (invariant A4-iii). Operational fallback: founder reviews Supabase rows (source of truth); email is convenience. No additional retry machinery, no queue — smallest reliable system.

### 5.7 Supabase (minimal, launch)
- One table `leads` (names follow Spec §35; only fields the form actually collects + ops defaults):
  `id uuid pk default gen_random_uuid()`, `submission_id uuid not null unique`, `created_at timestamptz default now()`, `name`, `phone`, `email null`, `preferred_contact`, `business_name null`, `industry null`, `website null`, `acquisition_channels jsonb not null default '[]'`, `primary_problem`, `requested_service`, `customer_value_range null`, `source text default 'website'`, `landing_page null`, `referrer null`, `utm_source/medium/campaign/content/term null`, `first_seen_at timestamptz null`, `submitted_at timestamptz default now()`, `status text not null default 'new'`, `owner text null`.
- **RLS enabled, zero policies** (no anon/authenticated read or write — no public lead access, ever). The function writes with the service-role key (bypasses RLS) from server-side secrets only.
- One committed migration file (`supabase/migrations/<ts>_leads.sql`) + a short ops note (apply via Supabase SQL editor or CLI; founder-owned). `notes/last_contact_at/next_action_at/lost_reason` are deferred — add when operations need them (schema-additive, non-breaking).
- Backup/recovery: documented founder step (Supabase free tier: database export/backup via dashboard or CLI before launch); rollback = re-run prior migration / restore backup — reasoning recorded in the Slice 2 ops note.

### 5.8 Analytics (smallest Cloudflare-native, verified)
- **Baseline:** Cloudflare Web Analytics beacon in `BaseLayout` (async, non-blocking; token is public, injected as a build-time env value). Page views + CWV. Confirmed: custom events and UTM logging are **not** supported by Web Analytics (official FAQ) — do not attempt `data-cf-analytics` custom events.
- **Acquisition events (Spec §36):** `src/scripts/analytics.ts` (framework-free, ~1–2 KB) sends `primary_cta_click`, `secondary_cta_click`, `audit_started`, `audit_step_completed{step}`, `audit_submitted`, `phone_click`, `messaging_click{channel}`, `service_opened{service}`, `case_study_opened{slug}`, `project_opened{slug}` to `POST /api/events` (Pages Function route in the same project) which writes them to the **Analytics Engine** binding (`NOVENO_EVENTS.writeDataPoint` — non-blocking, free tier). Event payloads contain **no PII** (no name/phone); attribution lives on the lead row, not in events.
- Non-blocking everywhere: module queues events, flushes with `fetch keepalive`/`sendBeacon` on idle + pagehide, wraps all calls in try/catch, never throws into UI handlers; `audit_submitted` fires from the client only after function success (it is a client event, not a persistence signal).
- **Zaraz:** deferred, not configured at launch — it is a tag manager, not a store; no free Cloudflare-native destination exists today; GA4 is blocked in Iran; Plausible/Fathom are paid. When the founder wants a third-party destination, the events module's semantic event names map 1:1 to `zaraz.track` calls (documented upgrade path, requires explicit founder approval for any destination).
- Local dev limitation: Analytics Engine is unavailable in `wrangler pages dev` → the events route degrades gracefully (returns 501 with a log line); verified on a preview deploy.

### 5.9 Cloudflare Pages production readiness (documented, not executed)
- Build: `npm run build` → `dist/`; Pages project settings: build command `npm run build`, output directory `dist`, functions directory auto-detected (`functions/`), `nodejs_compat` via committed `wrangler.jsonc` (or dashboard flag).
- Environment (names only, in `.env.example`):
  - Build-time public: `APP_ENV`, `PUBLIC_APP_URL`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_WEB3FORMS_ACCESS_KEY`, `PUBLIC_CF_ANALYTICS_TOKEN`.
  - Pages secrets (never in repo): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`.
  - Binding: `NOVENO_EVENTS` (Analytics Engine) — configured in dashboard/wrangler, not an env var.
- `_headers` (Slice 2): immutable caching for `/fonts/*`, baseline security headers (CSP is build-agent's judgment — static site, no inline-script ban on the theme snippet; keep pragmatic).
- Rollback: redeploy previous commit; Supabase schema additive-only at launch. Runbook + founder setup checklist (create Supabase project, Turnstile keys, Web3Forms access key, Pages project + secrets, apply migration, verify preview) delivered as a doc in Slice 2.

### 5.10 Data/control flow (single picture)
```
Visitor ──▶ Static Astro site (fa/RTL, theme, Journey Line)        [Slice 1]
              │  CTAs → /contact (Slice 1) → /audit (Slice 2)
              │  Web Analytics beacon (page views/CWV, non-blocking)
              ▼
        /audit multi-step form (framework-free TS)                 [Slice 2]
              │  sessionStorage draft · submission_id · attribution capture · Turnstile widget
              ▼
        POST /api/audit ──▶ Pages Function (only server boundary)  [Slice 2]
              │  body size limit → field validation → honeypot → Turnstile siteverify
              │  (mandatory, remoteip + idempotency_key) → per-IP limiter
              ▼
        Supabase leads.insert(onConflict submission_id ignore) ──▶ 200 {ok,id} │ 502
              │ (service-role key, server-only; RLS on, zero policies)
              ▼ success only
        client → Web3Forms POST (keepalive, ≤2.5s, best-effort email)  →  /audit/thank-you
        client events → POST /api/events → Analytics Engine (non-blocking, no PII)
        /audit/thank-you: extended JourneyLine + «شما اینجا هستید» + NextStepsRail + contact fallback
```
Invariants: 200 ⇔ Supabase row exists (fresh or replay). Notification failure never loses the lead. Client state is never trusted for persistence decisions. Secrets exist only in Pages secrets.

## 6. Slice 1 — Flagship Website Experience (exact boundary)

**In scope.** Astro scaffold + tooling + verification routes + CI extension; font pipeline (self-hosted, ≤200 KB, preload estedad-arabic, local fallbacks); token system + both themes + no-flash init + accessible toggle; global shell (Header desktop non-sticky / mobile sticky with CTA, MobileMenu, Footer with contact facts + mini JourneyLine + privacy/terms links, SectionHeader node marker, CTASection); UI component inventory (DESIGN §10) with full states; Journey Line SVG patterns (4 patterns + proof line-style code + SystemArchitectureDiagram + StepperLine component); `src/data/site.ts`; content layer + `work` schema + launch content files (real entries founder provides; labeled concepts only otherwise); pages `/`, `/services`, `/work`, `/work/[slug]`, `/process`, `/about`, `/contact`, `/privacy`, `/terms`, `/404`; per-page metadata foundation (title/description/canonical/OG, `fa`+`rtl`); hero draw + reduced-motion; responsive recompositions per DESIGN §8 (12/4-col, RTL, 320px reflow, mobile-first); accessibility foundations (WCAG 2.2 AA per §14); performance foundations (JS ≤15 KB gzip, images AVIF/WebP + lazy, inline SVG diagrams). **Primary CTAs point to `/contact` via the `CTA_URL` constant** (no /audit route, no stubs, no dead ends).

**Explicitly out.** `/audit`, `/audit/thank-you`, any form submission code, `functions/`, Supabase/Web3Forms/Turnstile wiring, analytics events module, sitemap/robots/structured-data completion, secrets, deployment.

**Ordered vertical work + stop points.**
1. Scaffold Astro + TS strict + Tailwind v4 + `astro check`; commit `wrangler.jsonc` placeholder; extend `.pi/verification.json` (`src/**` → check+build+structural tests; `functions/**` → function tests+build) and CI job. — stop: `astro build` + `astro check` green; affected routes plan (`--plan`) resolves; full gate still green.
2. Fonts (fontsource deps → `public/fonts/` subsets, @font-face, fallbacks, preload) + token/theme layer + no-flash script + toggle. — stop: fonts ≤200 KB asserted; no-flash + contrast verified in browser (matrix screen 10).
3. Global shell + UI components + states. — stop: keyboard/focus/labels/320px reflow pass; header/footer RTL evidence.
4. Journey Line SVG patterns + proof line-style code + motion (hero draw, reduced-motion). — stop: matrix screens 2, 3, 5 diagram evidence; RTL direction check.
5. Data module + content layer/schema + launch content files. — stop: `astro check` validates schema; /work + detail pages render all three proof types with correct tags/lines; no-fabrication content review.
6. All Slice 1 pages per DESIGN §8–9 + metadata foundation + 404. — stop: full site walkthrough; matrix screens 1–7, 11–12 (1440 + 390, both themes).
7. Performance + accessibility + evaluator pass (reviewer, frontend-design flagship gates) + full gate. — stop: full gate green; no BLOCKER/MAJOR; craft ≥ 3.25/4 with no dimension < 3 (screenshots as reproducible artifacts).

**Slice 1 exit = ready for independent /design-review; Slice 2 may start.**

## 7. Slice 2 — Acquisition Flow & Production Integration (exact boundary)

**In scope.** `/audit` page (DESIGN §11: two-column desktop with StepperLine rail, single-column mobile, 6 stations, MultiSelect chips with keyboard navigation, per-field + step + form validation, submitting state, error banner + retry with values preserved, offline banner, progress announce via aria-live); `/audit/thank-you` (extended JourneyLine, dashed future stations «بررسی ← تماس ← گفتگو ← پیشنهاد», «شما اینجا هستید» marker, NextStepsRail, contact fallback, optional pointer to a real case study); `src/scripts/audit.ts` (state machine, sessionStorage draft, attribution capture, submission_id, Turnstile explicit render, submit/retry semantics); `functions/api/audit.ts` (trust boundary per §5.5) with unit tests; `functions/api/events.ts` + `src/scripts/analytics.ts` (event model, Analytics Engine, non-blocking, no PII); Web3Forms notification module (client-side, §5.6); Supabase migration + ops note; `_headers` (fonts immutable + security headers); sitemap.xml, robots.txt, structured data (Organization/Service), metadata completion; `.env.example` extension + Pages setup checklist + runbook (no deployment executed); lab performance measurement (CWV targets per QUALITY), final security/a11y hardening; `CTA_URL` flip to `/audit`.

**Explicitly out.** Auth, CMS, CRM UI, dashboard, payment, blog, industry pages, rate-limit persistence beyond in-memory, notification retry machinery beyond one client retry, Zaraz configuration, deployment.

**Ordered vertical work + stop points.**
1. Function core (validation/normalization/contract) as pure, testable modules + unit tests (defect-sensitive: fail on pre-fix behavior). — stop: `node --test tests/audit-function.test.mjs` green incl. Persian-digit normalization, enum whitelist, length caps.
2. `/audit` UI (static) + StepperLine wiring + audit.ts state machine + sessionStorage restore + validation UX. — stop: browser journey through all 6 steps; reload-mid-journey restores draft; keyboard + aria snapshot.
3. Trust boundary completion: Turnstile siteverify (test keys in test env), limiter, Supabase insert with idempotency, response contract; integration test against staging Supabase (marker rows, cleanup). — stop: A4/A5 negative-path evidence (simulated Supabase failure → 502, never success; duplicate submission_id → one row; turnstile fail → 403).
4. Client submit flow + Web3Forms notification + thank-you page. — stop: full journey in real browser incl. simulated network failure (values preserved), offline banner, notification-failure simulation (lead intact — A4-iii evidence), success state (matrix screens 8–9).
5. Analytics: events module + `/api/events` + Analytics Engine + beacon; event-firing network evidence; degradation checks. — stop: A6 attribution evidence (UTM → lead row); events observed on /api/events without PII.
6. SEO/production completion: sitemap, robots, structured data, metadata audit, `_headers`, Pages checklist + runbook, `.env.example`. — stop: sitemap/robots validate; secret scan + project-verify green.
7. Hardening + gates: `risk-review` + `security-auditor` on the trust boundary (unresolved BLOCKER/MAJOR blocks completion); lab CWV measurement on throttled profile; full browser matrix (8–9 + regression retest of 1–7, 10–12); full gate green; final reviewer pass. — stop: all acceptance criteria A1–A7 evidence collected; full gate green.

## 8. Dependencies between the slices

- Slice 2 **consumes** from Slice 1: design system (Button, FormField, Select, MultiSelect, Textarea, ProofTag, StepperLine, diagrams, tokens, theme, layouts), `src/data/site.ts` (contact facts, stations, CTA constant), `work` collection (thank-you case-study pointer, proof-type rendering), fonts/performance baseline, verification routes + CI, `.env.example` conventions.
- Slice 1 must therefore deliver the DESIGN §10 component inventory and the content schema as a **stable contract** (names/APIs are build-agent choice, but the inventory and states are not negotiable).
- Slice 2 does not require Slice 1 to be production-deployed — only merged and green.
- Slice 1 deliberately avoids `/audit` and submission code so there is no throwaway work and no stub that Slice 2 must replace.

## 9. Risks (material only)

- **R1 — Web3Forms free-tier constraint (resolved).** Official docs: server-side usage requires paid plan + server-IP whitelisting (impractical for Cloudflare egress). Resolution: client-side notification gated behind function success (§5.6); Supabase remains source of truth. Residual: notification depends on the browser session → mitigated by `keepalive` + short await + one retry; founder ops baseline = Supabase review. Do not silently "fix" by switching notification providers — requires explicit approval.
- **R2 — Turnstile in Iranian networks / token lifecycle.** Widget script must load; managed/non-interactive mode minimizes friction; contact redundancy (phone/WhatsApp/Telegram/email) is the resilience fallback (Spec §64.1). Tokens are single-use and short-lived → retry always resets the widget; siteverify uses `idempotency_key` for safe retry of the verification call itself.
- **R3 — supabase-js in the Pages runtime.** Requires `nodejs_compat`; if the client misbehaves in Workers, fall back to direct PostgREST `fetch` with the same service-role secret — function contract unchanged. Verify at Slice 2 step 3.
- **R4 — Analytics reality check.** Web Analytics does not support custom events (verified); Analytics Engine binding is not available in local `wrangler pages dev` → events verified on preview deploy; module degrades gracefully. Zaraz is deferred with a documented trigger condition (founder wants a third-party destination).
- **R5 — Content availability.** No real case studies at launch is acceptable only with the honest labeled path (concepts/projects only, no invented metrics, no fake testimonials/logos). Content review is part of both slice gates.
- **R6 — Free-tier function limits.** 10 ms CPU budget is not a problem for two outbound fetches (I/O is wall-time, not CPU); keep the function single-purpose and small; in-memory rate limiter is isolate-local (documented; Turnstile is the primary abuse gate).
- **R7 — Duplicate/race.** Parallel duplicate submissions with the same `submission_id` are collapsed by the unique constraint + `onConflict` ignore; both responders receive 200 (truthful — the lead exists once).
- **R8 — Data integrity/backup.** Lead records are business-critical: migration is additive-only at launch; founder backup/restore step (Supabase export) documented in the ops note before first production submission; rollback = redeploy previous commit (site) + additive schema stays compatible.
- **R9 — Persian normalization correctness.** Phone/name normalization must be a pure tested module; Persian digits (۰–۹), Arabic digits (٠–٩), and Latin digits all normalized before persistence and before Web3Forms payload (tested).
- **R10 — No-theme-flash and CLS.** Inline script ordering, `color-scheme` meta, font fallback metrics, and reserved aspect ratios are build-time verified via browser evidence (matrix screen 10; CLS target ≤ 0.1).

## 10. Verification / evaluator strategy

- Use the **existing repository verification system**; no parallel workflow. Extend `.pi/verification.json` in Slice 1 step 1: `src/**` → `astro check` + `astro build` + structural tests; `functions/**` → function tests + build; `docs/**`/`package.json`/config → existing routes; unmatched → full fallback.
- Structural tests (node:test, repo convention): every built HTML page has `lang="fa" dir="rtl"` and no LTR leakage; `package.json` dependency assertion (no react/vue/svelte); font budget ≤ 200 KB; token values from DESIGN §6 present in built CSS; content schema rejects fabricated-metric shapes (metrics require `source` + `verified`).
- Function tests: pure-module unit tests with defect sensitivity (fail on pre-fix behavior — e.g., Persian-digit normalization, whitelist bypass, missing Turnstile); integration test against a staging Supabase project with marker rows + cleanup; Turnstile official test keys (always-pass/always-fail/duplicate) in test env only.
- Browser QA (`browser-qa` skill, lazy Playwright MCP): accessibility snapshots and DOM/console/network evidence first; screenshots under `.artifacts/playwright/` with state provenance (route, viewport 1440/390/320, theme, fa-RTL); reduced-motion check; theme no-flash test; keyboard + aria snapshot of the audit flow; network panel evidence for events.
- Evaluators: `reviewer` at each slice exit; `frontend-design` flagship gates on Slice 1 (avg ≥ 3.25, no dimension < 3, signature ≥ 3/4 on specificity/execution — per DESIGN §15); `security-auditor` + `risk-review` on the Slice 2 trust boundary (unresolved BLOCKER/MAJOR blocks completion). Max two evidence-driven repair rounds per gate.
- Gates per slice: targeted during work → feature once per vertical step → full (`bash scripts/verify.sh`) at slice exit and final delivery. Lab CWV (throttled) in Slice 2 with the recorded baseline; field data comes later via Web Analytics RUM — lab results are not presented as field proof.

## 11. Decisions intentionally deferred (founder-owned; isolated so they never block build)

| Decision | Isolation mechanism | Default while undecided |
|---|---|---|
| Hero headline (Spec §11.2 candidates) | `HERO_HEADLINE` constant in `src/data/site.ts`; both candidates verified to fit the display treatment (DESIGN §5.2) | Candidate A («بازدید را به یک مسیر قابلپیگیری…») until founder picks |
| Audit free-vs-paid policy (Spec §15) | No price/«رایگان» claims in audit copy; copy avoids commitment | Neutral: «بررسی مسیر جذب» without price framing |
| Public pricing (Spec §39) | Services page uses the scoped-after-audit framing; no numbers; easy-update structure if prices arrive later | «پروژهها پس از بررسی مسیر، Scope میشوند» |
| Logo recolor (DESIGN §17: green semantic tokens vs legacy purple) | Single logo component; geometry unchanged; `fill` from tokens | Recolor to `text`/`primary` tokens (DESIGN-recommended) — founder confirms at review |
| Zaraz/third-party analytics destination | Events module emits semantic names; Zaraz wiring documented as upgrade path | Not configured at launch |
| Web3Forms Pro features (webhook, autoresponder) | Not used; no paid plan | — |

## 12. Handoff-ready current state and first action

**Current state.** Bootstrap + design complete; no application code; this plan is the single durable artifact for launch. External facts verified against current official sources (list in §3). `.env.example` has `APP_ENV=development` only; verification routes have no `src/**` route yet; CI runs `scripts/verify.sh` + package integrity.

**Smallest first implementation action (Slice 1, step 1):** scaffold the Astro + TypeScript + Tailwind v4 app at the repo root (`npm create astro` with strict TS), wire `astro.config.mjs` + `tsconfig`, add `@astrojs/check`, confirm `npm run build`/`npm run dev`/`npm run check` work on the repo's Node ≥ 22.19 baseline, then extend `.pi/verification.json` with `src/**` and `functions/**` routes and the CI app job. Stop when `astro build` + `astro check` + `scripts/verify.sh` are all green.

**Must not be overwritten:** `AGENTS.md`, `docs/DESIGN.md` (accepted contract), `docs/ARCHITECTURE.md` invariants, `branding_assests/` (reuse geometry; no recreation), `scripts/*` verification system, `.env.example` (names only).

**Handoff note.** Update this plan's Status/Evidence sections before any `/handoff` or context reset; keep it factual, not a transcript. The working tree and tests remain authoritative if this plan becomes stale.
