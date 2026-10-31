# Architecture Decisions — Noveno Website

Durable constraints and accepted decisions only. Where the Master Spec (Spec §59) and the accepted bootstrap overrides differ, the bootstrap overrides win; conflicts are noted below.

## Current system

- **Runtime/platform:** **Astro 7 + TypeScript, statically rendered**. Output deploys to **GitHub Pages** (custom domain `noveno.ir`) from CI. There is no server runtime: no Pages Functions, no SSR, no API routes.
- **Main modules:** (shipped) Astro pages per the launch IA (Spec §8.1), Astro components, and framework-free TypeScript modules for interactive behavior (`src/scripts/`). The audit journey (`src/scripts/audit/`) owns validation, draft persistence, and Web3Forms delivery.
- **Data stores:** **none.** Audit leads are delivered as **email via Web3Forms** (client-side) and are not durably stored anywhere by this site (2026-10 founder decision: no lead database for v1).
- **External services:** Web3Forms client-side lead email delivery on audit submission (shipped; the free tier requires client-side posting). **Cloudflare is not part of the stack** (2026-10 static-only migration): no Turnstile, no Web Analytics beacon, no Analytics Engine, no `functions/`. WhatsApp/Telegram (09102256986) and email (imdanialrashidi@gmail.com) are contact channels only.
- **Deployment topology:** static assets on GitHub Pages built and uploaded by `.github/workflows/quality.yml` after the canonical gate. Nothing executes server-side; GitHub Pages cannot set response headers or 301 redirects.
- **Single-request pages:** `scripts/inline-critical.mjs` (postbuild) inlines CSS and bundled module JS into each page and removes the font preload. Reason: on some networks every subresource request to the custom domain stalls while the document still loads (observed 2026-10-31), so a page that needs a stylesheet never renders. Fonts remain progressive (`font-display: swap`).

## Trust boundaries and critical data flows

1. **Public static site (untrusted visitors)** → audit form (client validation) → the browser posts the sanitized lead straight to **Web3Forms** → Web3Forms confirms `{ success: true }` → thank-you. There is **no server trust boundary**: the browser is the only place validation runs, the Web3Forms access key is public by design, and a direct POST to Web3Forms can bypass the form. Mitigations are the hidden honeypot, Web3Forms spam filtering, and human review of the inbox — not a security boundary.
2. Everything else on the site is static and contains no secrets and no dynamic data. Legacy `/insights/*` links are forwarded to `/blog/*` by the built `404.html` (a visitor-side redirect, not a 301).

## Non-negotiable invariants

- **Static by default:** no SSR; no conventional backend, authentication system, CMS, custom CRM, or client portal.
- **No client UI framework:** no React/Vue/Svelte; interactivity via Astro components + small framework-free TypeScript modules (bootstrap override vs Spec §59's "React only where it adds real value").
- **Persian-first, RTL-first** rendering; light+dark themes with system default, persisted explicit override, and no incorrect-theme flash on first paint.
- **Success semantics are truthful:** the visitor reaches thank-you only after Web3Forms confirms the email was accepted. A validation pass, a 200 with `{ success: false }`, or a network error never presents success.
- **No fake trust boundary:** with no server runtime, the site must not imply server-side validation. Any future server-side gate is new architecture, not a hidden assumption.
- **No secrets in the repository** (`.env*` gitignored except `.env.example` which documents variable names only, never values).
- **No fabricated proof**: demo/concept content must be explicitly labeled; metrics only with evidence (Spec §19).
- **No speculative infrastructure** for theoretical future scale; dependencies only with a concrete current benefit.

## Chosen patterns

| Area             | Decision                                                                          | Why                                                                                                                                                                                                                                                                                                                      | Revisit when                               |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Framework        | Astro + TypeScript                                                                | Content-heavy marketing site; static generation; minimal JS; selective interactivity (Spec §59)                                                                                                                                                                                                                          | A real requirement demands SSR/ISR         |
| Styling          | Tailwind CSS                                                                      | Accepted bootstrap override; system is RTL/Persian-first                                                                                                                                                                                                                                                                 | Repository evidence proves it wrong        |
| Interactivity    | Astro islands with framework-free TS modules                                      | No client framework accepted; the audit form is the main interactive surface                                                                                                                                                                                                                                             | —                                          |
| Lead delivery    | Web3Forms (email-only, browser-side)                                              | 2026-10 founder decision: v1 needs no durable lead store; the free tier requires client-side posting; email is the destination. Bounded to 2 delivery attempts per submit; a manual retry may add a third email with the same `submission_id` and a higher `delivery_attempt`. Filter by `submission_id` to deduplicate. | A real lead pipeline/dashboard is demanded |
| Audit submission | Browser-only: client validation → sanitized Web3Forms payload                     | GitHub Pages is static; there is no server to validate against. The hidden honeypot and Web3Forms spam filtering are the only abuse controls.                                                                                                                                                                            | A server-side trust boundary is accepted   |
| Analytics        | Event queue in `src/scripts/analytics.ts`, no ingest endpoint                     | Without a server or analytics vendor there is nowhere to send events; `EVENT_URL` is empty so no request is made. Attribution (UTM/referrer/landing) still rides in the lead email.                                                                                                                                      | A concrete analytics destination is chosen |
| Content          | Astro Content Collections (Markdown) for case studies when content exists         | No CMS until editing needs justify it (Spec §59)                                                                                                                                                                                                                                                                         | Editing needs arise                        |
| Theme            | CSS custom properties per light/dark palette; system default + persisted override | Accepted bootstrap prompt requirement; inline early script avoids the wrong-theme flash                                                                                                                                                                                                                                  | design pass defines the full token set     |

## Explicitly rejected complexity

- SSR/ISR application rendering; client frameworks; GraphQL; microservices; Redis/message queues/WebSockets; Kubernetes; complex client state; heavy animation libraries; headless CMS; multi-tenant SaaS; custom dashboards; user accounts/auth (Spec §60).

## Operational baseline

- Configuration: `.env.example` documents build-time names only (`APP_ENV`, `PUBLIC_APP_URL`, `PUBLIC_WEB3FORMS_ACCESS_KEY`, `PUBLIC_WEB3FORMS_URL`). Values live in GitHub Actions repository variables — never committed. There are no server secrets.
- Data: no database, no migrations, no backups to run. Lead emails live in the founder's Web3Forms inbox; retention is governed by Web3Forms/email policy (see `/privacy`).
- Logging/monitoring: none beyond GitHub Actions run logs and Web3Forms submission emails. The site ships no analytics beacon; a browser-only failure is only visible to the visitor (the banner offers direct contact).
- Rollback: revert the commit on `main`; the workflow rebuilds and redeploys. GitHub Pages keeps the previous artifact until the new deployment completes.
