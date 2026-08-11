# Noveno (نوونو) — Production Website

The production website for **Noveno** — an Iranian service-and-systems business that helps small and medium service businesses turn scattered customer attention into a clearer, trackable path from visit to inquiry, lead capture, follow-up, and improvement. Primary conversion: **qualified audit requests** (درخواست بررسی مسیر جذب).

## Repository state

This repository bootstrapped the Pi-assisted workflow (harness) and is now identified as the **Noveno production website project**. No application code exists yet — the next lifecycle step is `/design` (experience direction), then `/plan` for the Phase 1 build. Do not implement the full website during bootstrap-stage tasks.

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
- Analytics: **Cloudflare Web Analytics** (baseline) + **Cloudflare Zaraz** (custom acquisition events); UTM/referrer/landing-page attribution persisted with the lead.
- **Persian-first, RTL-first**; light + dark themes (system default, persisted override, no theme flash); accepted color anchors in `docs/DESIGN.md`.

## Canonical commands (current bootstrap state)

```bash
./p                          # launch Pi with project trust + pinned packages
bash scripts/verify.sh       # canonical full gate (pi-doctor + project contract)
bash scripts/project-verify.sh   # fast static project-contract check
node scripts/verify-affected.mjs --file <path> [--plan]  # affected-change routing
node --test tests/*.test.mjs # workflow + project-contract behavior tests
bash scripts/pi-doctor.sh --ci --static   # static harness validation
```

App commands (`npm install` / `npm run dev` / `npm run build` / `npm run test`) arrive with the Astro scaffolding at `/plan`; `.pi/verification.json` routes will then gain `src/**` evidence routes.

## Verification lanes

- **Targeted/affected:** `node scripts/verify-affected.mjs --file <path>` — routes in `.pi/verification.json`; unmatched files fall back to the canonical full gate.
- **Feature:** once after a bounded slice: project contract + relevant tests + build (once the app exists).
- **Full:** `bash scripts/verify.sh` — runs `scripts/pi-doctor.sh --ci` (harness integrity, security scan, context budgets, workflow tests) then `scripts/project-verify.sh` (Noveno doc/branding/env contract). CI mirrors this in `.github/workflows/quality.yml`.

## Browser QA

Lazy Playwright MCP (`/mcp status`); accessibility snapshots and DOM/console/network evidence first, screenshots under `.artifacts/playwright/` as reproducible artifacts. Deterministic browser tests (once the app exists) stay separate from interactive MCP exploration.

## Contact / facts

Brand: Noveno / نوونو · WhatsApp/Telegram/Phone: 09353598620 · Email: imdanialrashidi@gmail.com · Instagram: @noveno.ir
