# Product Roadmap — Noveno Website

Product-level path from idea to production. Task-level, multi-session execution state belongs in `docs/exec-plans/active/`. Source: Master Spec §72–73 plus accepted bootstrap decisions.

## Outcome and boundaries

- Product outcome: a Persian-first, RTL, mobile-first marketing site that converts qualified SMB visitors into **audit requests** (primary conversion) and demonstrates Noveno's own philosophy: clear, measured, simple, transparent.
- Measurable success: qualified audit requests generated; audit completion rate and CTA click rate improving; every submission persisted + notified (Spec §6).
- Explicit non-goals: no client portal/auth/CMS/SSR/backend beyond the audit-form function; no blog or industry pages at launch; no fabricated proof; no infrastructure for hypothetical scale.
- Deadline / capital / compliance constraints: none accepted; Cloudflare free-tier-compatible where practical; Iranian network realities are product requirements, not afterthoughts.
- Current stage: **Stage 2 entry — bootstrap and `/design` complete; the launch build plan is accepted in `docs/exec-plans/active/noveno-launch.md`** (two slices: flagship site → acquisition flow & production integration). No application code exists yet.

## Evidence ledger

| Claim or assumption | Status | Evidence | Next test / decision |
|---|---|---|---|
| Master Spec v1.0 is the product source of truth | confirmed | `docs/Noveno_Website_Master_Spec.md` (84 sections) | Keep current |
| Business DNA v1.1 is the identity source | confirmed | `docs/Noveno Business DNA.md` | Keep current |
| Brand anchors: light/dark palettes, contact facts, assets under `branding_assests/` | confirmed | Accepted bootstrap prompt; asset files present | /design token development |
| Astro + TS + static Cloudflare Pages, no client framework, Supabase + email via one Pages Function, Cloudflare analytics | confirmed (accepted) | Bootstrap prompt overrides | First build validates practicality |
| SMB owners complete a multi-step audit form | assumed | None yet | Launch → measure audit completion rate |
| Web Analytics + Zaraz satisfy acquisition measurement | assumed | None yet | Configure at build; verify events in staging |
| Self-hosted licensed Persian font is feasible on Cloudflare free tier | confirmed | DESIGN §5.4 (≈165 KB measured) + npm packages verified | Slice 1 font pipeline proof |
| Two-slice launch plan maps the accepted scope | confirmed | `docs/exec-plans/active/noveno-launch.md` (A1) | Execute Slices 1–2 |
| Web3Forms free tier requires client-side submission | confirmed | docs.web3forms.com API reference (server-side = paid plan + IP whitelist) | Slice 2 notification wiring |
| Web Analytics lacks custom events; Analytics Engine is the Cloudflare-native store | confirmed | Web Analytics FAQ + Pages Functions binding docs | Slice 2 `/api/events` |
| Audit free-vs-paid policy | deferred | — | Business decision (Spec §15) |
| Prices on site | deferred | — | Business decision (Spec §39) |

## Stage gates

### 0. Discovery proof
- Scope: target user (SMB service businesses), painful job (lost/trackless leads), current alternative (scattered channels), riskiest assumption (audit-form conversion).
- Exit evidence: **done** — thesis in `docs/PRODUCT.md`, positioning in Master Spec §3, ICP in §4.
- Next smallest experiment: launch Phase 1 and measure audit completion.

### 1. Experience direction  ✔ DONE (exit evidence: accepted `docs/DESIGN.md`, 2026-08-11; screen-proof plan in DESIGN §15)
- Scope: critical journey (understand → qualify → audit), IA (Spec §8.1), brand character, visual thesis, theme tokens, typography (licensed Persian font), RTL/mobile composition, light/dark mechanics.
- Exit evidence: accepted `docs/DESIGN.md`; critical states and desktop/mobile proof plan defined.
- Decision owner: `/design` run, evaluated against `docs/QUALITY.md` + `frontend-design` gates.

### 2. Walking skeleton
- Scope: one deployable end-to-end path: static site shell on Cloudflare Pages + audit function → Supabase → email, with analytics tags.
- Exit evidence: canonical install/start/test path works (`npm install`/`npm run dev`/`npm run build`/`npm run test` once the app lands), `scripts/verify.sh` green, function exercised in a real browser with a test lead (staging), rollback = redeploy previous commit.
- Verification: verification routes in `.pi/verification.json` extended with `src/**` evidence once the app exists.

### 3. Vertical MVP
- Scope: Phase 1 launch scope (Spec §73) — homepage, services, work, process, about, audit, thank-you, contact, privacy, terms; analytics events (Spec §36); lead persistence + notification; acceptance criteria from `docs/PRODUCT.md` (Spec §74).
- Exit evidence: must-have journeys function with real submission data, negative paths (validation errors, abuse, offline), attribution preserved, accepted visual quality.
- Non-goals: insights, industry pages, testimonials without real data, dashboards.

### 4. Internal alpha
- Scope: founder-led use; real audit submissions flow to Supabase + email; controlled failure testing (function outage, Supabase outage → visible error, no silent loss).
- Exit evidence: no release-blocking correctness/security/accessibility issues; recovery path (lead data backup/restore reasoning) exercised.
- Feedback sample / owner: founder.

### 5. External beta
- Scope: bounded promotion; monitor audit completion, CTA clicks, phone/messaging clicks; support via WhatsApp/Telegram/phone.
- Exit evidence: activation and guardrail metrics meet targets; field performance (Web Analytics) measured; top UX failures resolved.
- Rollback trigger: form failure rate spike or silent-loss incident → revert deployment, alert founder via email.

### 6. Release candidate
- Scope: frozen launch scope; security review of the form boundary (`risk-review` + `security-auditor`); performance lab budget; accessibility pass; `/ship` READY.
- Exit evidence: no unresolved BLOCKER/MAJOR; recovery/rollback and runbook proven.
- Sign-off owners: founder.

### 7. Staged production
- Scope: progressive exposure with telemetry; explicit stop conditions on conversion or reliability metrics.
- Exit evidence: health window passes per stage; incident/support ownership active (founder).
- Stages and stop conditions: internal → referral/limited → public; stop on silent form failure or conversion collapse.

### 8. Learning loop
- Scope: qualified-audit outcomes, failed conversions, support signals.
- Exit evidence: validated learning updates `docs/PRODUCT.md`, roadmap, regression tests.
- Review cadence: monthly with the monthly reporting offer in mind (DNA §24).

## Critical path and risks

| Risk / dependency | Control or experiment | Owner | Decision date / trigger |
|---|---|---|---|
| Audit-form conversion unproven | Measure starts/completion from launch; keep form short | founder | 30 days after launch |
| Email/Supabase deliverability in Iran | Choose replaceable providers; contact redundancy on site (Spec §64.1) | founder | implementation |
| Persian font licensing/performance | /design selection of licensed self-hosted font; performance proof | /design | design stage |
| Cloudflare Pages function limits on free tier | One narrow function; static by default | /design+build | build stage |
| Fabricated-proof drift in content | Proof policy (Spec §19) enforced in QUALITY + copy review | review agents | every content change |

## Next bounded slice

- Goal: **Slice 1 — Flagship Website Experience** per `docs/exec-plans/active/noveno-launch.md` (Astro scaffold, design system, theme/typography/fonts, Journey Line patterns, content layer, all Slice 1 pages), then Slice 2 — Acquisition Flow & Production Integration.
- Acceptance proof: the plan's criteria A1–A7; DESIGN §15 screen matrix (slices 1–7, 10–12 then 8–9); `frontend-design` flagship gates; `scripts/verify.sh` green.
- Recovery / rollback: build work is reversible on a task branch; Git revert of the slice diff if the direction is rejected.

## Deferred decisions

- Full visual system, tokens beyond the accepted anchors, typography, motion, media direction → `/design`.
- Astro project scaffolding details, package manager (npm/pnpm), Tailwind config → `/plan` (first build).
- Supabase schema/table names, email transport provider, function route shape → `/plan` (with risk review).
- Prices, audit pricing policy, headline copy, hero visual → business decisions (see `docs/PRODUCT.md` open decisions).
- Insights, industry pages, productized platform (Spec §72 Phases 3–5) → only after real evidence.
