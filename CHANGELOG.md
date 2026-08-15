# Changelog

All notable workflow changes are documented here. This project follows the spirit of Keep a Changelog; versioning begins when the first release is tagged.

## Unreleased

### Added

- **Email-only audit architecture (2026-10):** Supabase removed entirely — no dependency, no `functions/lib/persist.ts`, no migration, no `supabase/` directory, no `SUPABASE_*` env. The audit function (`/api/audit`) now validates only and returns `{ ok: true, status: "validated" }`; Web3Forms is the sole lead-delivery destination and the only completion gate — the visitor reaches `/audit/thank-you` (and `audit_submitted` fires, the draft clears, the done marker records) only after Web3Forms confirms `{ success: true }`. Delivery failures (network/timeout/non-2xx/`success:false`/429) keep the visitor on `/audit` with preserved values, a truthful recoverable banner with direct-contact fallback, and a retry that mints a fresh Turnstile token. Web3Forms payload carries the full audit data with readable Persian labels and `submission_id` (duplicate recognition) but never the Turnstile token. Founder setup is now just Turnstile keys + Web3Forms access key + Pages project — no database step. `/privacy` copy updated to the email-only reality.

- **Brand pass (2026-10):** the homepage hero becomes an original signal-field brand artwork («نشانه‌های پراکنده → سامانهٔ منظم») — inline SVG, no screenshot/photo/flowchart in the hero; scattered marks settle into a hairline system plate with the Noveno mark as attractor; motion = one-shot settle + acknowledgment blink + ≤6px pointer parallax (reduced-motion aware); hero LCP is now the headline text (36 KB preloaded hero screenshot removed). **Insights → Blog:** «دیدگاه‌ها»/`/insights` becomes وبلاگ at `/blog` + `/blog/[slug]` with permanent 301s from old URLs (`public/_redirects`), canonical sitemap/OG/breadcrumbs/internal links, typography-first blog index (no required thumbnails), and `docs/BLOG.md` founder publishing guide. Homepage OG card now mirrors the brand-art geometry.

- **README rewrite:** complete usage guide — quick start + env vars, content-driven work portfolio, the three proof-type honesty contract, copy-paste frontmatter templates (project / concept / case-study), preview-image pipeline (real screenshots + `optimize-work-previews.py`), `work-previews.ts` registration, sitemap step, and a per-entry verification checklist.
- **Contact points designed (2026-08-14):** new monoline channel icon set (`Icon`: phone, whatsapp, telegram, email, instagram) and `ChannelLink` (inline / row / tile variants) — footer list rows with hover-fill chips, mobile-menu contact tiles (full-width call row + 2×2 channel grid), contact-page rows with 56px icon tiles, audit rail/banners/thank-you inline links, phone icons inside CTA/FAQ/contact buttons; tokens + `data-event` analytics preserved.
- **Image-led editorial redesign (2026-08-14, founder-directed):** the flowchart/route visual language (JourneyLine, LeadStatusStrip, SystemArchitectureDiagram, scatter fields, route-band hero, station rails, route motifs) was removed from the public design and replaced by Typography + Photography + Real Product Screens + Editorial Numbers — new hero photo composition, homepage media rhythm (~6 moments), editorial numerals (۰۱–۰۶), designed concept previews (labeled «نمونه نمایشی»), audit progress as «مرحله X از ۶» + progress bar, numbered thank-you next steps, typographic 404, re-captured real work screenshots, CC0 photography with caption provenance, `docs/IMAGERY.md` registry, and an updated `docs/DESIGN.md` contract.
- Behavioral coverage for autonomous/strict guard modes and launcher trust overrides.
- Product design contract, distinctive frontend-design skill, visual hard gates, and scored craft rubric.
- Idea-to-production prompts: discover, design, spec, ADR, build UI, design review, release plan, and incident response.
- Evidence-gated product roadmap template.
- Safety-guard behavior tests and a contained Docker launcher.
- Security reporting and dependency-review policy.
- `test-design` and `/test` workflows with red/pre-fix defect-sensitivity guidance.
- Deterministic affected-file verification routing with a conservative full-gate fallback.
- Workflow eval schema v2 with executable assertions, trace metrics, baseline comparison, and a real code/test repair fixture.
- Primary-source research and audit record in `docs/RESEARCH.md`.

### Changed

- **Contact facts (2026-08-15):** Telegram handle switched from the phone link (`t.me/+989353598620`) to the username `t.me/noveno_ir`; Instagram handle `@noveno.ir` → `@noveno_ir` (`src/data/site.ts` + schema.org `sameAs`). Web3Forms access key wired into the audit client via `PUBLIC_WEB3FORMS_ACCESS_KEY` (build env, public by design; real value stays in Cloudflare Pages project settings / local gitignored `.env`).

- **OG card generation decoupled from the production build (Cloudflare Pages `No module named PIL` fix):** `prebuild` no longer runs the Python generator — it now validates the committed `public/og/` cards with a dependency-free Node script (`scripts/validate-og-assets.mjs`, PNG signature + 1200×630, per-work/per-published-article coverage, drafts excluded) and fails the build with a clear message on a missing/invalid card. Cards are rendered locally via `npm run generate:og` (or `npm run build:with-og`) and committed; the repo ships `.node-version` (22.23.2) so Pages honors the `>=22.19` engine instead of its 22.16.0 default. Publishing docs (`docs/BLOG.md`, `docs/IMAGERY.md`, `README.md`) updated accordingly.
- Made `./p` trust the checked-out project and run autonomously by default: routine workflow edits, task-branch Git delivery, public browser navigation, and focused page evaluation no longer require intermediate approval; the optional Docker launcher selects strict mode.
- Narrowed the safety guard to high-blast-radius actions such as secret access, destructive host/Git commands, force/deleting pushes, publication/deployment/production mutation, and browser file exfiltration.
- Replaced archived `pi-context7` with maintained `pi-doc-search`.
- Removed delegated image-analysis extensions, model configuration, tools, and workflow guidance; browser QA now relies on browser-native evidence and saved screenshots as artifacts.
- Removed the template's forced model/provider selection.
- Pinned Pi installation guidance and GitHub Actions by immutable revision.
- Raised browser QA, accessibility, responsive, and Core Web Vitals requirements for visual work.
- Made the canonical full verification gate validate the template before product source is bootstrapped.
- Reduced duplicate always-loaded policy and added a combined context-size ratchet.
