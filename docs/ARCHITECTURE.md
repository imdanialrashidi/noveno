# Architecture Decisions — Noveno Website

Durable constraints and accepted decisions only. Where the Master Spec (Spec §59) and the accepted bootstrap overrides differ, the bootstrap overrides win; conflicts are noted below.

## Current system
- **Runtime/platform:** none implemented yet (bootstrap state). Accepted direction: **Astro + TypeScript, statically rendered**, deployed to **Cloudflare Pages**. No SSR.
- **Main modules:** (planned) Astro pages per the launch IA (Spec §8.1), Astro components, framework-free TypeScript modules for interactive behavior, one narrowly scoped Cloudflare Pages Function for the audit-form submission boundary.
- **Data stores:** **Supabase** — accepted lead-persistence destination for audit submissions (bootstrap override; supersedes the Spec §59 "Sheet/CRM for MVP" suggestion). No other database.
- **External services:** email notification on audit submission (transport chosen at implementation); Cloudflare Web Analytics (baseline traffic/performance) and Cloudflare Zaraz (custom acquisition events); WhatsApp/Telegram (09353598620), email (imdanialrashidi@gmail.com) as contact channels — no third-party integration code required.
- **Deployment topology:** static assets on Cloudflare Pages CDN; the audit function as a Pages Function attached to the same project; Pages secrets for credentials. Free-tier-compatible.

## Trust boundaries and critical data flows
1. **Public static site (untrusted visitors)** → audit form (client validation for UX only) → **Pages Function (the only server boundary)**: server-side validation, abuse protection (rate limiting/honeypot), attribution packaging (landing page, referrer, UTM) → **Supabase lead insert** → **email notification** → thank-you page. Credentials for Supabase/email live only in Pages Function environment variables; the client never sees them.
2. Everything else on the site is static and contains no secrets and no dynamic data.

## Non-negotiable invariants
- **Static by default:** no SSR; no conventional backend, authentication system, CMS, custom CRM, or client portal.
- **No client UI framework:** no React/Vue/Svelte; interactivity via Astro components + small framework-free TypeScript modules (bootstrap override vs Spec §59's "React only where it adds real value").
- **Persian-first, RTL-first** rendering; light+dark themes with system default, persisted explicit override, and no incorrect-theme flash on first paint.
- **Form boundary is the only server code**; it must validate server-side, cannot silently fail, and must persist every accepted submission to Supabase plus trigger email notification.
- **No secrets in the repository** (`.env*` gitignored except `.env.example` which documents variable names only, never values).
- **No fabricated proof**: demo/concept content must be explicitly labeled; metrics only with evidence (Spec §19).
- **No speculative infrastructure** for theoretical future scale; dependencies only with a concrete current benefit.

## Chosen patterns
| Area | Decision | Why | Revisit when |
|---|---|---|---|
| Framework | Astro + TypeScript | Content-heavy marketing site; static generation; minimal JS; selective interactivity (Spec §59) | A real requirement demands SSR/ISR |
| Styling | Tailwind CSS | Accepted bootstrap override; system is RTL/Persian-first | Repository evidence proves it wrong |
| Interactivity | Astro islands with framework-free TS modules | No client framework accepted; audit form is the main interactive surface | — |
| Lead persistence | Supabase | Accepted bootstrap override; managed Postgres, free tier, no ops burden | Volume or compliance demands change |
| Audit submission | One Cloudflare Pages Function (`/api/audit`-style route) | Keeps credentials private, server-side validation, abuse protection, persistence + email trigger (accepted override) | Backend demand grows beyond one form |
| Analytics | Cloudflare Web Analytics + Zaraz | Cloudflare-native, free-tier compatible, privacy-aware; attribution (UTM/referrer/landing) persisted with the lead | Product requires non-Cloudflare tooling |
| Content | Astro Content Collections (Markdown) for case studies when content exists | No CMS until editing needs justify it (Spec §59) | Editing needs arise |
| Theme | CSS custom properties per light/dark palette; system default + persisted override; inline early script to avoid flash | Accepted bootstrap prompt requirement | /design defines the full token set |

## Explicitly rejected complexity
- SSR/ISR application rendering; client frameworks; GraphQL; microservices; Redis/message queues/WebSockets; Kubernetes; complex client state; heavy animation libraries; headless CMS; multi-tenant SaaS; custom dashboards; user accounts/auth (Spec §60).

## Operational baseline
- Configuration/secrets: `.env.example` documents required variable names only (`APP_ENV=development` currently). The audit function will need named variables (Supabase URL/service key, email transport) added to `.env.example` **and** Cloudflare Pages secrets at implementation time — never committed values.
- Migrations: Supabase schema for the lead model (Spec §35 fields) created at implementation; treated as a data-integrity change (needs risk review).
- Backup and tested restore: lead records are business-critical (Spec §62); backup/recovery reasoning required at implementation time.
- Logging/monitoring: Cloudflare Web Analytics for traffic/performance; Pages Function logging for submission failures (no lead content in logs); no secrets in logs.
- Rollback: Cloudflare Pages redeploy of a previous commit; schema rollback reasoning for Supabase at implementation time.
