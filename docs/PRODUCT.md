# Product Contract — Noveno Website

Durable source of truth for what the product must do. Sources: `docs/Noveno_Website_Master_Spec.md` (primary), `docs/Noveno Business DNA.md` (identity), accepted bootstrap overrides. Keep this document short; the Master Spec remains the full reference.

## Users and problem
- Primary users: **small and medium Iranian service businesses** that need more qualified customers and have a reachable decision-maker, a defined service, real (if limited) budget, and existing scattered attention/inquiries.
- Context, ability, language, and device assumptions: **Persian-speaking, mobile-first**, operating under Iranian network conditions (unstable connectivity, filtered services, tool/payment restrictions). Owner is typically non-technical and wants to understand what brings customers.
- Problem being solved: many businesses do not lack a website — they lack a **trackable path from attention to action**. Inquiries arrive through scattered channels (Instagram, calls, messages, referrals), are not recorded, and are poorly followed up, so leads are lost and no channel is measurable.
- Current alternative / workaround: relying on Instagram alone, unconnected forms/phone/messaging, sheets or memory for leads — fragile and unmeasurable.
- Why now: SMB attention is scattered across channels; Noveno's category (customer-acquisition and lead-management systems for service businesses) is the differentiated wedge vs generic web-design agencies.

## MVP outcome
- Measurable outcome: **qualified audit requests** ("درخواست بررسی مسیر جذب") — the single primary conversion; not pageviews (Spec §6.1, §69.1).
- Riskiest product assumption: an SMB owner who lands on the site will complete a short multi-step audit form to start a conversation (rather than only calling/messaging). _Assumed, not yet validated._
- Smallest experiment that tests it: launch site → measure audit starts, audit completion rate, and primary CTA click rate via Cloudflare analytics (Spec §6.2–6.3).
- Deadline / hard constraints: none accepted yet. Launch scope is intentionally constrained (Spec §73): `/`, `/services`, `/work`, `/work/{case}`, `/process`, `/about`, `/audit`, `/audit/thank-you`, `/contact`, `/privacy`, `/terms`.
- Supported platforms and environments: modern mobile-first browsers, Persian (fa) RTL, light+dark themes; performance must hold on slower mobile connections (Spec §50).

## Must-have user flows
1. **Audit conversion (primary):** understand → qualify → start audit (`/audit`) → submit form → `/audit/thank-you` with next steps → lead persisted (Supabase) + email notification. Attribution (landing page, referrer, UTM) preserved with the lead (Spec §31–33).
2. **Direct contact fallback:** phone, WhatsApp, Telegram, email always reachable; contact redundancy is a resilience requirement, not an afterthought (Spec §64.1). Contact facts: 09353598620 (WhatsApp/Telegram/phone), imdanialrashidi@gmail.com, Instagram @noveno.ir.
3. **Proof journey:** `/work` with case studies/projects/concepts; every claim traceable, every demo labeled (Spec §18–19).
4. **Qualification:** explicit good-fit / bad-fit section reduces bad leads (Spec §23).

## Non-goals
- No client portal, user accounts, authentication, CMS, conventional backend, or custom CRM (Spec §60; accepted bootstrap override).
- No blog/insights at launch; no industry pages until real traction (Spec §42, §44, §8.2–8.3).
- No guaranteed-sales claims, fake testimonials, fake logos, or invented results (Spec §19, §53–54).
- No SSR, no client UI framework, no speculative infrastructure (accepted bootstrap overrides).

## Acceptance criteria
Pre-launch acceptance per Spec §74 (condensed):
- [ ] New visitor understands Noveno's category quickly; site does not read as a generic web-design agency.
- [ ] One primary conversion; service hierarchy limited to the three core offers.
- [ ] Every case study real, every result evidence-backed, every demo labeled; no fabricated testimonials/logos.
- [ ] Navigation clear; mobile usability strong; audit form easy to complete with clear error states; thank-you flow explains next steps.
- [ ] Persian copy natural, specific, non-hype; no sales guarantee; consistent CTA language.
- [ ] Production build passes; no secrets in repo; server-side form validation; no silent form failure; basic abuse mitigation; analytics events tested; attribution preserved; sitemap/metadata complete.
- [ ] Pages usable on slower mobile connections; JS limited to interactive needs; images compressed; stable layout; minimal third-party scripts.
- [ ] Keyboard navigation, visible focus, labeled inputs, sufficient contrast, reduced-motion respected.
- [ ] Every audit submission enters a reliable lead system; lead source captured; clear owner/next action operationally.

## Security, privacy, and compliance constraints
- Data classification: lead data (name, phone, business info, attribution) is business-critical and personal; never exposed publicly or in logs.
- Critical access rules: server-side validation at the form boundary; no client-trusted state; secrets only in Cloudflare Pages Function environment (never in the repository); rate limiting/abuse mitigation on submission.
- External/payment providers: Supabase (lead persistence), email notification (transport chosen at implementation), Cloudflare Web Analytics/Zaraz. No payment processing.
- Retention/deletion requirements: privacy page must explain collected data, purpose, and correction/deletion path (Spec §63); legal text must be reviewed for Iranian legal requirements before launch.

## Performance and UX budgets
- Core page/API target: static-first rendering, minimal JS; CWV `good` thresholds (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75) as targets pending a lab budget accepted during design/build (Spec §50).
- Supported device/network baseline: mobile-first, slow/unstable Iranian networks; AVIF/WebP, responsive images, lazy non-critical media, self-hosted essential assets (Spec §50, §64.2).
- Accessibility target: WCAG 2.2 AA (Spec §51).
- Brand character (`x, not y`): clear and systematic, not flashy; measured and honest, not hyped; business-first, not tech-first; calm and precise, not generic (Spec §45, §82, §83).
- Visual ambition: flagship (per accepted bootstrap prompt), but the visual thesis itself is intentionally deferred to `/design`.
- Required locales and directions: Persian (fa), **RTL-first**; light and dark themes with system default and persisted override.
- Link to accepted visual contract: `docs/DESIGN.md`

## Measurement and operations
- Activation / success event: `audit_submitted` (qualified audit request) — Spec §36 event model.
- Guardrail metrics: audit completion rate, primary CTA click rate, phone/messaging clicks, lead source visibility; funnel from visitors → CTA → audit start → submission → qualified lead (Spec §6.3).
- Required product telemetry: Cloudflare Web Analytics (traffic/performance baseline) + Cloudflare Zaraz for custom acquisition events; attribution persisted with the lead record (accepted bootstrap override).
- Support / recovery expectation: contact redundancy (form, phone, WhatsApp/Telegram, email); form must never silently fail (Spec §61).

## Open product decisions
- Prices and pricing display (Spec §39) — business decision, not defined by the spec.
- Whether the audit is free or paid as policy (Spec §15).
- Hero headline selection between the two approved candidates (Spec §11.2).
- Persian font choice, hero visual, and all visual-system decisions — deferred to `/design`.
