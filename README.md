# Noveno (نوونو) — Production Website

The production website for **Noveno** — an Iranian service-and-systems business that helps small and medium service businesses turn scattered customer attention into a clearer, trackable path from visit to inquiry, lead capture, follow-up, and improvement. Primary conversion: **qualified audit requests** (درخواست بررسی مسیر جذب).

**Visual direction (2026-08-14 founder redesign):** image-led editorial system — typography + photography + real product screenshots + editorial numbers. The flowchart/route visual grammar was removed from the public design by founder decision (`docs/DESIGN.md` §3).

---

## Quick start

```bash
npm install          # install dependencies (Node.js ≥ 22.19)
npm run dev          # local dev server (http://localhost:4321)
npm run check        # astro check (types + content schema validation)
npm run build        # production build → dist/
npm run preview      # serve the built site locally
npm test             # project test suite (node --test tests/*.test.mjs)
bash scripts/verify.sh   # canonical full gate (build + pi-doctor + project contract)
```

Environment variables are **names only** in `.env.example` — copy it to `.env` for local development and fill values; real secrets live in the Cloudflare Pages project settings, never in the repository:

| Variable | Purpose |
|---|---|
| `PUBLIC_APP_URL` | Canonical site URL for metadata/SEO |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (client-side) |
| `PUBLIC_WEB3FORMS_ACCESS_KEY` | Web3Forms access key (email notification) |
| `PUBLIC_WEB3FORMS_URL` | Optional Web3Forms endpoint override (local testing) |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics beacon token |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` | **Server-side secrets** — Cloudflare Pages secrets only |

> The audit form needs `PUBLIC_TURNSTILE_SITE_KEY` + `PUBLIC_WEB3FORMS_ACCESS_KEY` to submit; without them the form still validates locally and shows the honest «not available» fallback with direct-contact options. The turnstile/supabase keys are only used by `functions/` (see `docs/ops/setup-checklist.md`).

---

## Repository state

The repository is the **Noveno production website project**: Slice 1 (flagship site — Astro app, all public routes), **Slice 2 (acquisition flow + production integration — `/audit`, `/audit/thank-you`, the Pages Function trust boundary, Supabase + Turnstile + Web3Forms wiring, analytics, SEO/production artifacts)**, and the **2026-08-14 founder-directed visual redesign** (image-led editorial system, contact-channel icon set) are committed and verified; launch awaits founder provisioning (`docs/ops/setup-checklist.md`) and a preview-deploy smoke.

## Source of truth

| Document | Purpose |
|---|---|
| `docs/Noveno_Website_Master_Spec.md` | Primary product/UX/content/technical spec (v1.0, 84 sections) |
| `docs/Noveno Business DNA.md` | Durable business identity (v1.1) |
| `docs/PRODUCT.md` | Product contract (users, outcome, flows, acceptance) |
| `docs/ARCHITECTURE.md` | Accepted technical direction and invariants |
| `docs/DESIGN.md` | Accepted visual contract (image-led editorial thesis, tokens, themes, media rules) |
| `docs/IMAGERY.md` | Image asset registry (sources, licenses, processing) |
| `docs/PLAN.md` | Roadmap, stage gates, deferred decisions |
| `docs/QUALITY.md` | Evaluator-facing quality contract + project invariants |
| `branding_assests/` | Brand assets — reuse these; do not recreate the logo |

## Tech stack

- **Astro 7 + TypeScript**, statically rendered, deployed to **Cloudflare Pages** (free-tier-compatible). No SSR.
- **No client UI framework** (no React/Vue/Svelte); interactivity via Astro components and small framework-free TypeScript modules (`src/scripts/`).
- **No backend/auth/CMS/CRM/client portal.** One narrowly scoped Cloudflare Pages Function (`functions/api/audit.ts`) handles the business-critical **audit-form submission boundary**: server-side validation, abuse protection, persistence to **Supabase**, and **email notification** (Web3Forms).
- Analytics: **Cloudflare Web Analytics** + a Cloudflare-native events path (`functions/api/events.ts` + `src/scripts/analytics.ts`, Analytics Engine binding `NOVENO_EVENTS`); UTM/referrer/landing-page attribution persisted with the lead.
- **Persian-first, RTL-first**; light + dark themes (system default, persisted override, no theme flash); Estedad + Vazirmatn self-hosted fonts; token system in `src/styles/global.css`.

**Directory map**

```
src/
├── content/
│   └── work/            ← WORK ITEMS (markdown + frontmatter — see below)
├── components/
│   ├── business/        WorkCard, ConceptPreview, NextStepsRail, OfferRow, StepperLine (audit progress)
│   ├── layout/          Header, MobileMenu, Footer, PageHero, SectionHeader, CTASection
│   └── ui/              Button, Icon, ChannelLink, ProofTag, FormField, Select, MultiSelect, FAQItem, Metric
├── data/
│   ├── site.ts          nav, contact facts, offers, stages, FAQ, copy constants
│   ├── audit.ts         audit form field definitions (client contract)
│   └── work-previews.ts ← preview metadata per work id (screenshots / concept layouts)
├── layouts/             BaseLayout (html shell), PageLayout (shell + header/footer)
├── pages/               route pages (index, services, work, process, about, contact, privacy, terms, audit, 404)
├── scripts/             theme.ts, menu.ts, audit.ts (form state machine), analytics.ts
└── styles/global.css    tokens, themes, typography, components layer
```

---

# Adding a work item (پروژهها / نمونهکارها)

The `/work` portfolio is fully content-driven: every entry is one markdown file in `src/content/work/`. A new file appears on `/work` (and the homepage work section, if featured) **after** you also register its preview in `src/data/work-previews.ts` and rebuild.

## 1. The honesty contract (read this first)

The site's proof integrity is **mechanically enforced** by the content schema (`src/content.config.ts`) and `tests/content.test.mjs`. Every entry must be one of exactly three types:

| Type | Tag shown | What it may claim | Schema guards |
|---|---|---|---|
| `case-study` | «مطالعه موردی» | Real client + real, **verified** results | `client.public: true` required; every metric needs `verified: true` + `source` |
| `project` | «پروژه» | Real implementation, **no outcome claims** | `outcome` must be `measuring` or `unknown`; metrics optional but evidence-bound |
| `concept` | «نمونه نمایشی — سناریوی مفهومی» | Fictional/demo scenario; design goals + proposed KPIs only | `metrics` forbidden; `goals` + `kpis` required; `client.public` must be `false` |

Rules that never change:

- **No fabricated proof.** A metric without a real, citable source cannot pass the schema or the tests.
- **Concepts never carry numbers** — their KPI lines are phrased «KPI پیشنهادی», never «نتیجه».
- **Projects state «نتیجه: در دست اندازهگیری»** until real data exists.
- The site renders these distinctions automatically (tags, outcome markers, dashed-border concept labels) — you only fill the frontmatter honestly.

## 2. Step-by-step

1. **Create the file** — `src/content/work/<slug>.md` (slug = URL path, e.g. `restaurant-acquisition` → `/work/restaurant-acquisition`). Use the matching template below.
2. **Fill the frontmatter honestly** — pick the template for your type and keep every field's meaning intact.
3. **Write the body** — markdown rendered in the detail page at 66ch measure; sections like `## مسئله`, `## آنچه ساخته شد`, `## وضعیت`, `## محدودیت` match the existing entries.
4. **Register the preview** in `src/data/work-previews.ts` (`previewFor(id)`):
   - `type: "project"` / `"case-study"` → real screenshot(s) (see §4) — the page shows your capture, labeled «تصویر واقعی از اجرای این پروژه».
   - `type: "concept"` → pick a mock layout (`"form"` = lead-capture page, `"course"` = course/info page) + a short `scenario` (read aloud by screen readers as the mock's description).
   - **Do not skip this step** — an unregistered id silently falls back to a concept mock, which would mislabel a real project.
5. **Set `featured: true`** for at most one entry — it opens the `/work` list in the large 7/5 row and appears on the homepage proof section. Homepage proof = featured entries only.
6. **Update `public/sitemap.xml`** — add the new `/work/<slug>` URL (the SEO contract test fails if a built page is missing from the sitemap, or the sitemap lists an unbuilt page).
7. **Verify** — see §5.

Sorting is automatic: featured first, then by `published_at` (newest first).

## 3. Frontmatter templates (copy-paste)

### Template A — پروژه (real project, no outcome claims)

```markdown
---
type: "project"
title: "نام پروژه"
industry: "حوزه فعالیت"
summary: "دو یا سه جمله: پروژه چیست، برای چه کسی، و نتیجه فعلاً در چه وضعیتی است."
client:
  name: "نام مشتری (یا خود نوونو)"
  public: true
published_at: "2026-08-14"
timeline: "از مرداد ۱۴۰۵ — در حال اجرا"
scope: "محدوده کار"
problem: "مشکل اولیه در یک پاراگراف."
solution: "راه‌حل در یک پاراگراف."
components:
  - "لندینگ"
  - "فرم لید"
  - "ثبت لید"
outcome: "measuring"   # یا "unknown" — هرگز عدد وعده داده نمی‌شود
featured: false
metrics: []            # فقط با داده واقعی؛ هر آیتم نیاز به source + verified: true
limitations:
  - "محدودیت تفسیر یا داده."
---

بدنهٔ مارک‌داون: ## مسئله، ## آنچه ساخته شد، ## وضعیت، ## محدودیت
```

### Template B — نمونه نمایشی (concept, demo scenario)

```markdown
---
type: "concept"
title: "سیستم جذب برای [کسب‌وکار نمونه]"
industry: "حوزه فعالیت"
summary: "سناریوی نمایشی: … اهداف طراحی و KPI پیشنهادی؛ بدون نتیجه اندازه‌گیری‌شده."
client:
  name: "… نمونه — سناریوی مفهومی"
  public: false
published_at: "2026-08-14"
timeline: "مفهوم — بدون اجرا"
scope: "طراحی مفهومی؛ بدون ساخت و اجرا"
problem: "مشکل فرضی سناریو."
solution: "مسیر پیشنهادی سناریو."
components:
  - "لندینگ"
  - "فرم لید"
  - "پیگیری"
goals:
  - "هدف طراحی: …"
  - "هدف طراحی: …"
kpis:
  - "KPI پیشنهادی: …"
  - "KPI پیشنهادی: …"
featured: false
---

این یک **سناریوی مفهومی و نمایشی** است؛ نه پروژه اجراشده و نه مشتری واقعی. …
```

> `metrics` در concept **ممنوع** است؛ `goals` و `kpis` الزامیاند. مشتری مفهوم همیشه `public: false`.

### Template C — مطالعه موردی (case study, real verified results)

Only publish this when you have **a real client who agrees to be public** and **verified data with a source**:

```markdown
---
type: "case-study"
title: "نام مطالعه"
industry: "حوزه فعالیت"
summary: "خلاصه: مسئله، کار، نتیجه کلیدی."
client:
  name: "نام مشتری واقعی"
  public: true
published_at: "2026-08-14"
timeline: "بازه اجرا"
scope: "محدوده کار"
problem: "مشکل اولیه."
solution: "راه‌حل."
components:
  - "لندینگ"
  - "فرم لید"
metrics:
  - name: "نام شاخص"
    value: "۱۲۳"
    unit: "درصد"
    period: "مرداد تا شهریور ۱۴۰۵"
    baseline: "مقدار قبل از تغییر"
    source: "منبع داده (داشبورد/گزارش)"
    verified: true
    note: "محدودیت تفسیر این عدد"
featured: false
limitations:
  - "محدودیت‌های تفسیر."
---

بدنه مارک‌داون: ## مسئله، ## آنچه ساخته شد، ## نتیجه، ## محدودیت
```

Every metric **must** carry `source` and `verified: true` — the schema rejects anything else. The detail page renders each metric with its source and limitation footnote automatically.

## 4. Preview images (real screenshots only)

- **Projects / case studies** — the preview must be a **real screenshot of the delivered product** (never stock, never a mock, never a diagram):
  1. Run the site (`npm run dev` or `npm run preview` after `npm run build`) and capture the real pages at 1440×900 (Playwright/DevTools screenshot, light theme).
  2. Optimize with the project script (Pillow required):
     ```bash
     python3 scripts/optimize-work-previews.py <home-png> <audit-png>
     ```
     The script asserts 1440×900 input and writes WebP at native + half size into `public/images/work/`. For a new project, extend the script's `JOBS` list with the new capture (or replicate the two variants manually).
  3. Reference the files in `previewFor(id)` with `src` + `srcset` (1440w + 720w) + descriptive Persian `alt`, plus optional `detailSrc`/`detailSrcset` for a second screenshot on the detail page.
- **Concepts** — no image files. Pick `layout: "form"` or `"course"`; the site renders the designed mock (labeled «نمونه نمایشی — سناریوی مفهومی») from `ConceptPreview.astro`.
- Photography elsewhere on the site is CC0, captioned, and registered in `docs/IMAGERY.md` — do not hotlink remote images.

Example registration (`src/data/work-previews.ts`):

```ts
export function previewFor(id: string): WorkPreview {
  if (id === "noveno-website") {
    return {
      type: "image",
      src: "/images/work/noveno-website-hero.webp",
      srcset: "/images/work/noveno-website-hero.webp 1440w, /images/work/noveno-website-hero-800.webp 720w",
      alt: "صفحه نخست وب‌سایت نوونو",
      detailSrc: "/images/work/noveno-website-audit.webp",
      detailSrcset: "/images/work/noveno-website-audit.webp 1440w, /images/work/noveno-website-audit-800.webp 720w",
      detailAlt: "فرم بررسی مسیر جذب در وب‌سایت نوونو",
    };
  }
  // concepts → designed mock layout + screen-reader scenario
  return { type: "concept", layout: "form", scenario: "…" };
}
```

## 5. Verification checklist for a new entry

```bash
npm run check          # content schema validation — catches wrong types/fields
npm test               # content honesty tests (metrics/concepts/project rules)
npm run build          # builds the new /work/<slug> page
bash scripts/verify.sh # canonical full gate
```

Then look at `/work`, `/work/<slug>`, and the homepage proof section in the browser (desktop + mobile, both themes) — the tag, outcome marker, preview, and detail-page rail should all match the entry's type. If the entry is `featured`, check the homepage too.

---

## Verification lanes

- **Targeted/affected:** `node scripts/verify-affected.mjs --file <path>` — routes in `.pi/verification.json`; unmatched files fall back to the canonical full gate.
- **Feature:** once after a bounded change: project contract + relevant tests + build.
- **Full:** `bash scripts/verify.sh` — builds the project (fresh `dist/` for structural tests), then runs `scripts/pi-doctor.sh --ci` (harness integrity, security scan, context budgets) and `scripts/project-verify.sh` (Noveno doc/branding/env contract). CI mirrors this in `.github/workflows/quality.yml`.

Structural tests (run inside the gate) also pin the design contract: the flowchart grammar classes are banned from built output, the homepage LCP media wiring (AVIF preload + eager hero) must exist, fonts ≤ 200 KB, interactive JS ≤ 15 KB gzip, every page `fa` + `dir="rtl"`, theme anchors present, no dead links, no env names leaked.

## Browser QA

Lazy Playwright MCP (`/mcp status`); accessibility snapshots and DOM/console/network evidence first, screenshots under `.artifacts/playwright/` as reproducible artifacts. Deterministic browser tests stay separate from interactive MCP exploration. Slice-2 trust-boundary states can be exercised locally with `node scripts/slice2-test-server.mjs [--mode ok|supabase-down|web3forms-down|turnstile-fail] [--port 8788]`.

## Contact / facts

Brand: Noveno / نوونو · WhatsApp/Telegram/Phone: 09353598620 · Email: imdanialrashidi@gmail.com · Instagram: @noveno.ir
