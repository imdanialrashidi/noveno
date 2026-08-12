# Noveno (نوونو) — Production Website

The production website for **Noveno** — an Iranian service-and-systems business that helps small and medium service businesses turn scattered customer attention into a clearer, trackable path from visit to inquiry, lead capture, follow-up, and improvement. Primary conversion: **qualified audit requests** (درخواست بررسی مسیر جذب).

## Repository state

This repository bootstrapped the Pi-assisted workflow (harness) and is now the **Noveno production website project**: Slice 1 (flagship site — Astro app, «مسیر» design system, all public routes) and **Slice 2 (acquisition flow + production integration — `/audit`, `/audit/thank-you`, the Pages Function trust boundary, Supabase + Turnstile + Web3Forms wiring, analytics, SEO/production artifacts)** are committed and verified; launch awaits founder provisioning (`docs/ops/setup-checklist.md`) and a preview-deploy smoke.

## Source of truth

| Document | Purpose |
|---|---|
| `docs/Noveno_Website_Master_Spec.md` | Primary product/UX/content/technical spec (v1.0, 84 sections) |
| `docs/Noveno Business DNA.md` | Durable business identity (v1.1) |
| `docs/PRODUCT.md` | Product contract (users, outcome, flows, acceptance) |
| `docs/ARCHITECTURE.md` | Accepted technical direction and invariants |
| `docs/DESIGN.md` | Accepted theme foundation; full visual direction deferred to `/design` |
| `docs/PLAN.md` | Roadmap, stage gates, deferred decisions |
| `docs/QUALITY.md` | Evaluator-facing quality contract + project invariants |
| `branding_assests/` | Brand assets — reuse these; do not recreate the logo |

## Accepted technical direction (summary)

- **Astro + TypeScript**, statically rendered, deployed to **Cloudflare Pages** (free-tier-compatible). No SSR.
- **No client UI framework** (no React/Vue/Svelte); interactivity via Astro components and small framework-free TypeScript modules.
- **No backend/auth/CMS/CRM/client portal.** One narrowly scoped Cloudflare Pages Function handles the business-critical **audit-form submission boundary**: server-side validation, abuse protection, persistence to **Supabase**, and **email notification**.
- Analytics: **Cloudflare Web Analytics** (baseline page views/CWV) + a **Cloudflare-native events path** (Analytics Engine binding via `functions/api/events.ts`) for custom acquisition events (Spec §36); UTM/referrer/landing-page attribution persisted with the lead. Zaraz is deferred until a third-party destination is explicitly wanted (plan §5.8).
- **Persian-first, RTL-first**; light + dark themes (system default, persisted override, no theme flash); accepted color anchors in `docs/DESIGN.md`.

## Canonical commands

```bash
./p                          # launch Pi with project trust + pinned packages
bash scripts/verify.sh       # canonical full gate (build + pi-doctor + project contract)
bash scripts/project-verify.sh   # fast static project-contract check
node scripts/verify-affected.mjs --file <path> [--plan]  # affected-change routing
node --test tests/*.test.mjs # workflow + project-contract behavior tests
bash scripts/pi-doctor.sh --ci --static   # static harness validation
```

App commands: `npm install` / `npm run dev` / `npm run check` / `npm run build` / `npm run test` / `npm run ci` (check → build → test). `.pi/verification.json` routes `src/**` + `public/**` changes to the app lane (check + build + structural/SEO/content tests), `functions/**` + `supabase/**` to the function lane (check + trust-boundary tests + build), and falls back to the full gate for unmatched files.

Slice 2 tooling: `node scripts/slice2-test-server.mjs [--mode ok|supabase-down|web3forms-down|turnstile-fail] [--port 8788]` serves the built site + the real Pages Functions with mock Supabase/Web3Forms and a recording Analytics Engine binding for deterministic browser QA of every trust-boundary state (inspection endpoints under `/api/__test/`). Local Turnstile testing uses the official always-pass sitekey/secret (see `docs/ops/setup-checklist.md`); production builds must never contain test keys (`tests/seo-contract.test.mjs` guards this).

## Verification lanes

- **Targeted/affected:** `node scripts/verify-affected.mjs --file <path>` — routes in `.pi/verification.json`; unmatched files fall back to the canonical full gate.
- **Feature:** once after a bounded slice: project contract + relevant tests + build (once the app exists).
- **Full:** `bash scripts/verify.sh` — builds the project (fresh `dist/` for the structural tests), then runs `scripts/pi-doctor.sh --ci` (harness integrity, security scan, context budgets, workflow tests) and `scripts/project-verify.sh` (Noveno doc/branding/env contract). CI mirrors this in `.github/workflows/quality.yml`.

## Browser QA

Lazy Playwright MCP (`/mcp status`); accessibility snapshots and DOM/console/network evidence first, screenshots under `.artifacts/playwright/` as reproducible artifacts. Deterministic browser tests stay separate from interactive MCP exploration.

## Contact / facts

Brand: Noveno / نوونو · WhatsApp/Telegram/Phone: 09353598620 · Email: imdanialrashidi@gmail.com · Instagram: @noveno.ir
