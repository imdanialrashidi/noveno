# Product Design Contract — Noveno Website

Visual and interaction source of truth shared by design, implementation, browser QA, and review. This file records the **accepted visual direction** (locked by founder decision 2026-08-14, second review: the flowchart/route language is rejected; **third review 2026-09: contextual photography is retired from the public visual language** — see §3.5; **fourth review 2026-10: the homepage hero becomes brand artwork and Insights becomes وبلاگ** — see §3.6 and the decision log §16). The thesis, tokens, composition, media, and proof plan below are the contract; later build/review work must implement this direction, not invent a new one. Changes require a deliberate, documented decision (§16).

## 1. Experience brief

- Product / surface: Noveno (نوونو) marketing website — Persian-first, RTL-first.
- Primary audience: owners/decision-makers of small and medium Iranian service businesses, non-technical, mobile-first, often on slow/unstable connections.
- Single job of this surface: make a relevant visitor quickly understand what Noveno does, who it is for, and take the primary action — **درخواست بررسی مسیر جذب** (request an acquisition-path review/audit).
- Desired user feeling before → after: scattered and unsure about why leads leak → **clear, calm, convinced this is a system, not a sales pitch**; the site itself must prove Noveno's own philosophy (Spec §83).
- Success signal: qualified audit submissions (see `docs/PRODUCT.md`).

## 2. Brand character

From Spec §45/§82/§83 — useful tensions, not vague adjectives:

- clear and systematic, not flashy or "AI-futuristic"
- calm and precise, not generic agency/SaaS
- measured and honest, not hyped or guaranteeing sales
- business-first and practical, not tech-first or tool-logo-heavy

## 3. Accepted visual thesis (founder override, 2026-08-14)

> **«تایپوگرافی + عکاسی + تصویر واقعی محصول + عددهای تحریریه»** — Noveno is presented as a well-run editorial publication about real service businesses: strong Persian typography carries the argument, real photography supplies the human context, real product screenshots supply the proof, and large editorial numerals carry every sequence. The site stays systematic **without drawing systems as diagrams**.

### 3.1 Founder decision — the flowchart language is rejected

The founder reviewed the rendered website twice and rejected the entire line-diagram family: Journey Line / route band / station-and-rail / node-and-connector / scatter diagrams / channel maps / miniature process graphs. The judgment is explicit:

- line diagrams feel technical and documentation-like;
- they look too small relative to the page;
- they create visual noise and weaken hierarchy;
- they do not feel premium and do not communicate quickly;
- they make the website feel sparse and abstract;
- they are visually repetitive.

**This is an override of the previous «مسیر»/Journey-Line thesis (§17, 2026-08-11 and 2026-08-14 first redesign).** Do not improve, resize, or iterate on those diagrams; the visual concept itself is rejected. Do not reintroduce a similar node-and-line grammar under another name. The word «مسیر» survives only as **product vocabulary** (the fixed CTA «درخواست بررسی مسیر جذب», offer names, and copy) — never as a drawn route.

### 3.2 The four visual primitives

1. **Strong editorial typography** — large Persian headlines, controlled supporting copy, deliberate asymmetric composition. Text itself carries the design: bold display type, strong numbers, clear hierarchy, confident whitespace. Empty space is composed, not filled with diagrams.
2. **Real product surfaces** — the main visual proof mechanism (homepage hero, system section, `/work`, `/work/[slug]`). Real work looks like real work: large restrained product previews of the audit interface and delivered sites. No screenshots inside fake decorative dashboards. Concept work uses **designed concept previews** (designed page mockups, never wireframe-diagrams) always labeled «نمونه نمایشی — سناریوی مفهومی».
3. **Restrained brand geometry** — hairline rules, square/circle primitives, subtle grid texture, logo-derived geometry. Used to frame product surfaces and to give the final CTA a memorable, quiet finish. Never decorative pattern walls.
4. **Editorial numbers and simple sequences** — where the old site drew process, the new site types it: «۰۱ جذب / ۰۲ متقاعدسازی / ۰۳ اقدام / …». Large numerals, strong headings, short descriptions, grid or vertical editorial layout. No connector line; sequence is communicated by ordering and typography.

Photography is **not** a primitive (third review, §3.5).

### 3.3 Why this direction (rejection record)

| Direction | Verdict | Reason |
|---|---|---|
| A. «مسیر» / Journey Line — drawn acquisition path | **REJECTED (founder, 2026-08-14)** | technical/doc-like, small relative to page, noisy, weak hierarchy, not premium, slow to read, sparse, repetitive |
| B. Image-led editorial system (typography + photography + real screens + editorial numbers) | **ACCEPTED** | communicates fast, feels premium and human, proves with real work, stays systematic without drawing systems |
| C. Operations-ledger aesthetic | Rejected as dominant thesis (2026-08-11) | reads utilitarian and cold; its numbered-step device is absorbed into primitive 4 |

### 3.4 Media rhythm rule

Aim for **4–7 meaningful visual/media moments per long page** — never one per section, never decorative filler. Every image must improve understanding, credibility, emotional connection, proof, or composition. The homepage uses ≈6 moments: hero brand artwork, problem editorial typographic states, real audit-UI screenshot, large work previews, (process stays typographic), brand-led final CTA.

### 3.5 Third review — photography retired from the public visual language (2026-09)

**Decision: contextual business photography is no longer a Noveno visual primitive.** The hero photograph, the problem-section photograph, and the final-CTA photograph are removed; the homepage photography slots are replaced by:

1. **Real product/UI surfaces** — the audit interface and real site surfaces (this site's own build) are the primary substantial visual material;
2. **Typography-led editorial composition** — text and editorial numerals carry argumentative sections (problem, philosophy);
3. **Restrained Noveno brand geometry** — hairline rules, square/circle primitives, subtle grid texture, logo-derived geometry;
4. **Truthful work previews** — real project screenshots; concepts stay clearly labeled «نمونه نمایشی — سناریوی مفهومی».

Target ratio: `typography/layout + real product UI + restrained brand geometry`, not photography. The hero must visually reinforce `توجه ← درخواست ← ثبت ← پیگیری` using real Noveno interface material, remain clean enough that the headline stays dominant, and never become a fake dashboard, invented CRM UI, browser-frame cliché, or decorative SaaS card. The final CTA is a brand-led typographic finish (strong type + CTA + restrained surface + logo geometry), never a photo.

Photography assets and their processing scripts were removed from the production path (`docs/IMAGERY.md` records the retirement and retention decision). The `figure.media-frame` language survives for **real product screenshots and work previews only**.

### 3.6 Fourth review — the hero becomes brand artwork; Insights becomes وبلاگ (2026-10)

**Decision: the primary Hero visual is no longer a product screenshot.** The real audit-UI composition (third review) proved the product but did not answer the founder's core visual concern: the hero should communicate **brand + concept**, not show a product surface. The hero now carries an original Noveno graphical signature — «نشانه‌های پراکنده → سامانهٔ منظم» (Scattered Signal → Structured System):

- a field of small scattered marks (rotated squares, dots, ticks — incoming attention) that perceptibly settles into an ordered system: a hairline **system plate** of registered squares whose pattern converges on the **Noveno mark drawn as a quiet hairline attractor** (vertex squares locked onto its geometry);
- chaos → order is **perceived** through alignment, spacing and orientation — never drawn as arrows, connectors, or labels; no text inside the art;
- the transition reads RTL (chaos right, structure left) so the eye flows from the headline into the artwork;
- restrained palette: semantic tokens only (text/line/line-strong/primary on canvas) — the artwork re-themes itself with Light/Dark; one subtle `surface-soft` plate; faint 60px field grid; no glassmorphism, no glows;
- motion (transform/opacity only): a handful of transition marks settle into alignment once, the plate surface materializes, one registered square blinks an acknowledgment after load, and a ≤6px two-layer pointer parallax runs on fine-pointer desktop only; `prefers-reduced-motion` renders the fully settled frame;
- **static-first**: the artwork is one inline SVG (≈4 KB, no raster, no library, no remote asset); the hero's LCP is now the headline text — the 36 KB hero screenshot and its preload are gone;
- desktop: the square field hangs slightly below the text block and bleeds 32px out of its column; mobile: the artwork is **recomposed** as a wide strip (shelf band + registered row + settling marks + scatter) — fewer, larger marks, never a shrunk desktop SVG.

**Proof stays below the hero**: real product screenshots remain the proof mechanism in the system section, `/work`, and work detail pages.

**Insights → Blog:** the section previously called «دیدگاه‌ها» (/insights) is now a conventional professional **وبلاگ** at `/blog` and `/blog/[slug]`. Old `/insights` URLs permanently redirect (301) to `/blog` (`public/_redirects`) — one canonical article URL. The publishing workflow stays Markdown-first (`docs/BLOG.md`).

## 4. Signature visual language

**Signature: the editorial media figure + the large numeral + the signal field.** Three restrained devices repeat across the site:

1. **Media figure** — `figure.media-figure` → `div.media-frame` (hairline border, 4px radius, reserved aspect ratio: hero 3:2, product 16:10, work 16:10) + `figcaption.media-caption` (12–13px Estedad 500, `text-faint`, states what the real surface is). All real product screenshots and work previews use this frame; it is the site's consistent picture language.
2. **Editorial numeral** — `.editorial-num`: Estedad 800, `clamp(2rem, 1.5rem + 2.2vw, 3.25rem)` (32→52px), `text-action` ink, tabular. Used for: system stages (۰۱–۰۶), process steps (۰۱–۰۵), offers (۰۱–۰۳), why-Noveno rows, 404 («۴۰۴»). Numbers are content, never decoration.
3. **Signal field** (hero + OG card) — the scatter-to-structure brand artwork (§3.6): a field of marks converging on the Noveno mark as attractor. This is the hero's visual identity and the homepage social card's geometry.

**What the site never draws anymore:** connected lines, stations, nodes on rails, scatter fields, channel maps, mini process graphs, route motifs, dotted route extensions, square/circle connector systems, or any decorative system-architecture diagram.

## 5. Typography — Persian as a first-class brand decision

### 5.1 Decision, source, license (unchanged — accepted 2026-08-11)

| Role | Family | Source | License | Weight axis |
|---|---|---|---|---|
| Display / UI / data | **Estedad** (استعداد) | npm `@fontsource-variable/estedad` v5.3.0 | **SIL OFL 1.1** | wght 100–900, variable |
| Body | **Vazirmatn** (وزیرمتن) | npm `@fontsource-variable/vazirmatn` v5.3.0 | **SIL OFL 1.1** | wght 100–900, variable |

Rationale: Estedad display — designed for screen use, compact, geometric, less ubiquitous than Vazirmatn, so headings read as deliberate; Vazirmatn body — the most battle-tested Persian text face. Both include Latin, both render Persian digits ۰–۹, both variable (one file per subset). Self-hosted under `public/fonts/`; no external font CDN.

### 5.2 Type roles and scale

Base: 16px; scale in `rem`. Line-heights generous because Persian joins four levels.

| Role | Family | Size / line-height | Weight | Use |
|---|---|---|---|---|
| Display (hero) | Estedad | `clamp(2.5rem, 1.4rem + 4vw, 4rem)` (40→64px) · lh 1.24 | 800 | Homepage hero only |
| Page H1 | Estedad | `clamp(1.875rem, 1.35rem + 2.2vw, 3rem)` (30→48px) · lh 1.3 | 800 | All non-home routes |
| H2 (section) | Estedad | `clamp(1.5rem, 1.15rem + 1.8vw, 2.5rem)` (24→40px) · lh 1.35 | 700 | Section titles |
| H3 | Estedad | `clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)` (18→22px) · lh 1.6 | 600 | Sub-blocks, offer names |
| Editorial numeral | Estedad | `clamp(2rem, 1.5rem + 2.2vw, 3.25rem)` (32→52px) · lh 1 | 800 | Sequences (۰۱…), 404 |
| Lead | Vazirmatn | 18–20px · lh 1.9 | 400 | Hero support, section intros |
| Body | Vazirmatn | 16–18px · lh 1.9 | 400/500 | Paragraphs |
| UI / label | Estedad | 14px · lh 1.7 | 500 | Buttons, nav, form labels |
| Caption / footnote | Estedad | 12–13px · lh 1.6 | 500 | Photo captions, proof footnotes, meta |

**No letter-spacing on Persian text** (breaks joining); tracking 0 for display; the Latin «NOVENO» wordmark may use modest +0.02–0.04em tracking.

### 5.3 Fallback strategy (CLS-safe, unchanged)

Stack: `"Estedad", "Estedad Fallback", "Vazirmatn", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`; body: `"Vazirmatn", "Vazirmatn Fallback", …`. `font-display: swap`; **preload only `estedad-arabic`** (the hero headline is the only LCP element — the hero carries no raster media since the fourth review). Metric-matched Tahoma fallback faces declared locally (CLS target ≤ 0.1).

### 5.4 Performance (measured, unchanged)

Four variable woff2 subsets ≈ **165 KB total**; budget **≤ 200 KB**. Served from `public/fonts/` with `Cache-Control: immutable` via Cloudflare Pages.

## 6. Semantic tokens

### 6.1 Color — Light «روز کاری» (Workday) — **unchanged anchors and roles** (verified WCAG 2.2 AA, 2026-08-11/13)

| Token | Value | Used for | Contrast vs canvas (verified) |
|---|---|---|---|
| `canvas` | `#f9fafa` | page background (anchor) | — |
| `surface` | `#ffffff` | form panel, menu | — |
| `surface-soft` | `#f1f4f2` | alternating section tint, final CTA band | — |
| `text` | `#070808` | primary text (anchor) | 19.2:1 |
| `text-muted` | `#4c5751` | secondary text | 7.2:1 |
| `text-faint` | `#66716b` | tertiary/labels, captions | 4.9:1 vs canvas; 4.6:1 vs `surface-soft` |
| `text-action` | `#2f7a5e` | editorial numerals, links, active labels | 4.9:1 vs canvas; 4.7:1 vs `surface-soft` |
| `line` | `#dfe3e1` | decorative hairlines | decorative |
| `line-strong` | `#7e8a83` | form-control borders | 3.4:1 (non-text ✓) |
| `primary` | `#679e86` | action fills, buttons (anchor) | button text `#06130d` on it: **6.2:1** |
| `primary-hover` | `#578d75` | button hover | 4.9:1 |
| `primary-active` | `#4f8a6f` | pressed | 4.7:1 |
| `primary-soft` | `#e3efe9` | selected chips | — |
| `accent-strong` | `#3b7d61` | green text accents, links | 4.7:1 |
| `success` | `#2e7d5b` | success icons/checks | 4.8:1 |
| `danger` | `#b03a34` | errors | 5.7:1 |
| `focus` | `#2f7a5e` | 2px focus ring | 4.9:1 (non-text ✓) |
| `on-primary` | `#06130d` | text on primary fills | see `primary` |

### 6.2 Color — Dark «اتاق عملیات» (Ops Room) — **unchanged anchors and roles**

| Token | Value |
|---|---|
| `canvas` / `surface` / `surface-soft` | `#050606` / `#0d1110` / `#101715` |
| `text` / `text-muted` / `text-faint` | `#f7f8f8` / `#aab5af` / `#7f8a84` |
| `text-action` | `#8fd4b0` |
| `line` / `line-strong` | `#232b28` / `#8d9a93` |
| `primary` / `primary-hover` / `primary-active` | `#619881` / `#6fae93` / `#6fae93` |
| `primary-soft` | `#173026` |
| `accent` / `accent-strong` / `accent-light` | `#3b7d61` / `#8fd4b0` / `#8fd4b0` |
| `success` / `danger` / `focus` | `#9dd8b7` / `#e07b74` / `#6fae93` |
| `on-primary` / `on-primary-soft` | `#06130d` / `#e8f3ed` |

Rule: **the primary button carries dark ink on green** (`#06130d` on `#679e86`/`#619881`) — white fails AA at 3.1:1. No token value may be changed without re-proving contrast against its real usage pair.

### 6.3 Non-color tokens (unchanged)

| Group | Token values |
|---|---|
| Spacing (4px base) | `2 4 8 12 16 24 32 48 64 96 128` px; section rhythm 96–120px desktop / 64–80px mobile |
| Radius | controls 4px; panels 8px (audit card only); **no pills** (tags 4px) |
| Border | hairline 1px `line`; form controls 1px `line-strong`; focus 2px `focus` + 2px offset |
| Depth | Light: one soft shadow token for the audit panel/menu; everything else flat. Dark: no shadows — elevation via surface tones + hairline |
| Motion | `--dur-1: 150ms` hover/focus; `--dur-2: 250ms` steps/accordion; `--dur-3: 400ms` messages; ease `cubic-bezier(.2,.7,.3,1)` |
| Icons | one custom monoline set, stroke 1.5–2px; used only for meaning (phone, WhatsApp, Telegram, check/cross for fit lists, error/warning, chevron) |
| Content measure | paragraphs ≤ 66ch (~640px); form column 560px max |

## 7. Themes — two complete designs, one mechanics (unchanged)

- **Light «روز کاری» (Workday):** near-white canvas with a faint cool cast, flat editorial sections separated by hairline rules, green reserved for action and live state. Depth minimal (one shadow for the audit panel/menu).
- **Dark «اتاق عملیات» (Ops Room):** true near-black canvas, panels lifted by surface tone (not shadow), hairlines at `#232b28`, green used as action fill and as signal. Muted text is gray-green.
- **Behavior:** OS preference via `prefers-color-scheme`; persisted explicit override as `noveno-theme` in `localStorage` (never write the OS default); no-wrong-theme-flash inline head script; accessible toggle button (`aria-pressed`, current-state label «حالت روشن/حالت تاریک»), also in the mobile header row; theme transitions ≤150ms, none under reduced motion.
- **Product surfaces in both themes:** screenshots are captured in the light theme and render inside the same hairline frame in both themes; no theme-specific treatments (a neutral, consistent grade is chosen at asset level).

## 8. Composition and layout language

- **Grid:** 12 columns desktop (content max 1200px), 4 columns mobile; RTL-native — first column is rightmost. Text measure ≤ 66ch.
- **Section anatomy:** hairline `border-t` separators; `py-16 lg:py-28` rhythm; alternating editorial splits (50/50, 58/42) rather than uniform columns. **No wall of cards**: containers only where grouping or interaction requires them (audit card, fit panels, mobile menu, next-steps panel).
- **Section headers:** `SectionHeader` = optional kicker (12–14px `text-faint`), H2 above a hairline rule, optional lead. No node markers, no icons.
- **Desktop width is used intentionally**: media columns span 5–7 of 12; hero is a 6/6 split; work rows alternate 7/5 and 6/6.
- **Header:** hairline bottom border; logo mark + English-only «NOVENO» wordmark (Estedad 800, +0.04em tracking); nav Estedad 500 14px; primary CTA button. Desktop non-sticky. **Mobile: compact sticky header with three elements only — logo, theme toggle (44px), menu trigger (44px); the audit CTA moves into the opened menu as a full-width primary button.** Verified no horizontal overflow at 320/360/390/430.
- **Footer:** contact facts always visible (click-to-call 09353598620, WhatsApp/Telegram/email — Spec §64.1 redundancy); short brand line; /privacy + /terms links. No route motif.

## 9. Imagery, media, art direction

### 9.1 Media hierarchy (proof-first, brand-first hero)

1. **Real product screenshots** — captured from real, accessible implementations (this site's own build for the `noveno-website` project). The proof mechanism for the system section, `/work`, work detail pages — never the primary hero visual (fourth review, §3.6).
2. **Brand artwork** — the hero's visual: the signal-field composition (scattered marks → structured system, Noveno mark as attractor), an original inline-SVG piece of branded information art (§3.6). Social cards mirror the same geometry.
3. **Designed concept previews** — for concepts only: a small designed page mockup (real tokens, real Persian UI labels) with the fixed overlay tag «نمونه نمایشی — سناریوی مفهومی». Never a wireframe-diagram, never a screenshot of a nonexistent product, never implying a real client result.
4. **Typography-led editorial composition + restrained brand geometry** — text, editorial numerals, hairlines, square/circle primitives, subtle grid texture, logo-derived geometry. The second visual primitive of the public site (problem section, philosophy, final CTA).
5. **No contextual business photography** — retired from the public visual language (third review, §3.5). Photography is not part of the production image path; see `docs/IMAGERY.md` for the retirement/retention record. No stock-agency clichés, no fabricated proof (Spec §18–19).

### 9.2 Art direction — product surfaces and brand geometry

- Real product screenshots: captured at 1440×900 from this site's own production build (light theme), processed to WebP pairs (native + half), right-sized, intrinsic `width`/`height`, lazy below the fold, `fetchpriority="high"` + preload only for the LCP hero figure.
- Brand geometry: hairlines, 4px-radius squares, small filled squares/circles as separators, a subtle 1px grid texture only where it adds quiet depth (hero band, final CTA) — never decorative pattern walls.
- Every product figure: `figure.media-figure` with caption stating what the real surface is («نمونه واقعی از رابط نوونو: …»); descriptive Persian `alt`; never decorative filler.
- Provenance registry: `docs/IMAGERY.md` lists file → source → license → processing.

### 9.3 Asset pipeline

- All substantial images: right-sized variants (1600w/800w, screenshots 1440w/720w), AVIF (only where it does not hurt text-bearing UI; screenshots stay WebP q80 — measured saving ≈9% on text-bearing UI) + WebP, intrinsic `width`/`height`, `srcset` + `sizes`, lazy below the fold. **The homepage hero carries no raster image** (inline SVG artwork — fourth review); `fetchpriority`/preload stay reserved for any future LCP media.
- Portfolio screenshots stay sharp on retina without shipping multi-megabyte originals (WebP q80, ~30–45 KB at 1440×900).
- Social cards: build-time generated PNGs (1200×630) from brand tokens + real project previews (`scripts/generate-og-images.py`) — no runtime OG service (`docs/INSIGHTS.md` for the article card flow).

## 10. Components and states

| Group | Components |
|---|---|
| Layout | Header, MobileMenu, Footer, PageHero, SectionHeader, CTASection (brand-finish variant) |
| UI | Button (primary / secondary / ghost), TextLink, ProofTag (3 text labels), FormField, Select, MultiSelect (channels), FAQItem, Metric (evidence-bound only), **Icon (monoline channel glyphs: phone, whatsapp, telegram, email, instagram)**, **ChannelLink (inline / row / tile variants — one contact-link contract for every surface)** |
| Business | WorkCard (editorial work row with large preview), ConceptPreview (designed concept mock), NextStepsRail (numbered 1–4), AuditProgress (StepperLine: «مرحله X از ۶» + progress bar) |

**Button language:** primary = `primary` fill, `on-primary` ink, 4px radius, min-height 48px; secondary = 1px `line-strong` + `text`; ghost = text link with visible focus. States: default / hover / focus-visible / disabled (opacity 45%, not color-only) / pressed.

**ProofTag:** the only badge — «مطالعه موردی» / «پروژه» / «نمونه نمایشی — سناریوی مفهومی» as plain typographic tags (text + hairline border only).

**Metric:** only for evidence-backed values; always paired with unit, period, source note, and limitation footnote (Spec §66). No standalone floating numbers.

**Empty/loading states:** static pages have none except — image placeholders (reserved aspect ratio, `surface-soft` wash), form submitting (inline progress), and network failure (see §11).

## 11. The /audit journey — treatment

- Progress: **«مرحله ۳ از ۶» + current step name + a clean horizontal progress bar** (AuditProgress). No station rail, no connectors. Counter and bar are driven by the audit script through `data-stepper-counter` / `data-stepper-current` / `data-stepper-bar` (names retained for script compatibility); step changes announce via `aria-live` (`#step-announce`).
- Page composition: two-column desktop (right: step content; left: quiet explainer + progress + direct-contact links), single-column mobile. Form card: `surface` panel, 8px radius, 560px measure, `line-strong` field borders.
- Steps ۱–۶: کسبوکار ← کانالها ← مشکل اصلی ← ارزش مشتری ← نیاز ← تماس (Spec §31). Step 2 = MultiSelect chips (selection via `aria-checked`, check glyph + fill + border, never color alone; ≥44px targets; keyboard arrows).
- Validation: client-side UX only; server authoritative. Inline errors with `aria-describedby`, danger color + icon + text; step message «یک مورد را کامل کنید»; calm specific copy.
- Submitting: primary button → inline progress («در حال ارسال…»), disabled, double-submit guarded.
- Success → `/audit/thank-you` with a **numbered «what happens next» sequence (1/2/3/4, NextStepsRail)** and always-visible contact fallback; no route diagram, no «شما اینجا هستید» marker.
- Recoverable error: inline banner «ارسال نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید» + تلاش دوباره; offline variant emphasizes contact fallback; field values preserved; never silent failure.
- Turnstile renders inside the contact step; re-renders on theme change; resets on retry.

## 12. Motion — the small reusable system (5 behaviors, site-wide)

Restrained; clarifies state or hierarchy only. The whole site uses **five reusable behaviors** (one shared `IntersectionObserver` in `src/scripts/motion.ts`; no animation library):

1. **Section reveal** — below-the-fold groups only: opacity + 12px translate, 450ms, stagger 45ms where a sequence matters. Content is visible by default (no-JS, no-CLS, no-LCP risk); hero content never animates.
2. **Hero moment** — the hero artwork's quiet settle: a handful of signals find alignment (one-shot, staggered), the plate surface materializes, one registered square blinks an acknowledgment; the stage strip under the artwork fades in with a tiny translate, and the accent line under the kicker grows (transform-only). LCP-critical content (headline) is painted immediately and never moves; the artwork's natural (settled) state is the default frame — no-JS and reduced-motion see it instantly. Pointer parallax (≤6px, two layers) only on fine-pointer desktop (`motion.ts initHeroParallax`).
3. **Link/button micro** — directional icon movement on hover/focus (work rows, contact rows), nav underline grows from the RTL start, pressed scale 0.98 on buttons (150ms).
4. **Work previews** — very small scale (1.015) on hover **and** keyboard focus (`:focus-within`), pointer devices only via hover media where practical.
5. **Mobile menu** — opacity + 6px translate open/close (250ms), `hidden` applied after the close transition, focus moved in/out, Escape closes.

Rules: transform/opacity only; no blur, no filters, no continuous loops, no raw-scroll listeners, no scroll-jacking, no parallax, no per-section reveals of every paragraph. Reduced motion: `prefers-reduced-motion: reduce` zeroes all durations in CSS AND `motion.ts` skips adding hidden starting states, so everything renders directly in its final state.

## 13. Content voice (unchanged rules)

- Labels are short business nouns. Fixed CTA language per Spec §3.5–3.6 («درخواست بررسی مسیر جذب»; «دیدن پروژهها»); hero microcopy «بدون وعده فروش تضمینی؛ ابتدا مسیر فعلی کسبوکار بررسی میشود».
- Prohibited hype per Spec §52.1; no guarantee language anywhere.
- Buttons describe the action they perform; error/success copy states what happened and what to do next. No decorative copy.
- Product-figure captions state the real surface; concept labels state the concept status.

## 14. Quality budgets (design constraints, unchanged)

- **Accessibility:** WCAG 2.2 AA — all token pairs verified ≥4.5:1 text / ≥3:1 large + non-text; keyboard + visible focus everywhere; labels on every input; errors linked to fields; reduced-motion honored; no color-only meaning; reflow at 320px; usable at 200% zoom; tap targets ≥44px.
- **Performance:** fonts ≤ 200KB (≈165KB measured); interactive JS ≤ 15KB gzip (measured 2026-08-21 post-email-only: 10147 bytes gzip — `tests/structural.test.mjs` baseline, audit 7269 gzip, total 27119 raw); images AVIF/WebP + `srcset` + lazy below fold; third-party = Cloudflare Web Analytics only; self-hosted fonts/scripts. CWV targets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (p75), lab budget accepted at build (QUALITY).
- **Themes:** fully token-driven; theme switch ≤150ms, no flash, persisted explicit override only.

## 15. Screen-level acceptance — what build/review must prove

Evidence per `browser-qa` + the visual-quality rubric: screenshots with state provenance (route, viewport, theme, locale fa-RTL), accessibility snapshots, reduced-motion check, network panel, lab CWV on a throttled profile. Flagship bar: average craft ≥ 3.25, no dimension < 3.

Post-photography hero/proof expectations: the homepage hero shows the **real audit UI** (product-led composition) with the headline dominant; the problem section is typographic; the final CTA is brand-led with logo geometry; no photograph appears in the primary visual path (browser + network evidence).

| # | Screen / state | Critical states | Viewports · themes | Proof required |
|---|---|---|---|---|
| 1 | Homepage hero | brand-art composition: signal-field artwork + 4-stage typographic strip; headline + dual CTA + microcopy; artwork settles once on load; reduced-motion = static | 1440 + 390 + 320 · light + dark | Screenshots ×3 viewports ×2 themes |
| 2 | Problem recognition | editorial typography: numbered list + today/with-Noveno states, no image | 1440 + 390 · both themes | Screenshots |
| 3 | System model | 6-stage editorial numerals + real audit-UI screenshot | 1440 + 390 · both themes | Screenshots; RTL check |
| 4 | Offers + process | 3 numbered offer rows; 5-step editorial sequence | 1440 + 390 | Screenshots |
| 5 | Proof section + /work | featured large preview + alternating rows; three proof labels explicit | 1440 + 390 | Screenshots; label contrast evidence |
| 6 | Work detail (project) | large real screenshots; honest outcome marker | 1440 + 390 | Screenshots; 200% zoom spot-check |
| 7 | Work detail (concept) | designed concept preview + «نمونه نمایشی» labels | 1440 + 390 | Screenshots |
| 8 | /audit | step default, selection, validation errors, submitting, network-error + retry with values preserved | 1440 + 390 + 320 · both themes | Full browser journey; error-state screenshots; keyboard + `aria` snapshot |
| 9 | /audit/thank-you | numbered next steps + contact fallback | 390 + 1440 | Screenshots |
| 10 | Theme behavior | OS-dark default, persisted override, toggle a11y, no wrong-theme flash | 390 + 1440 | Browser evidence |
| 11 | Contact + footer | click-to-call, messaging links, contact redundancy | 390 | Screenshots |
| 12 | Global shell | header (desktop non-sticky, mobile 3-element sticky), menu, focus order, RTL | 390 + 1440 | Accessibility snapshot |

## 16. Decision log

| Date | Decision | Evidence / rationale | Revisit when |
|---|---|---|---|
| 2026-10 | **Fourth review: the homepage hero becomes original brand artwork, and Insights becomes a conventional Blog.** Hero: the audit-UI composition is replaced by «نشانه‌های پراکنده → سامانهٔ منظم» — an inline-SVG signal field (scattered marks settling into a hairline system plate whose pattern converges on the Noveno mark as attractor). No screenshot/photo/flowchart in the hero; proof stays below (system section, work). The 36 KB preloaded hero screenshot is gone; LCP is now the headline text; hero network cost ≈ 0. Motion: settle + one ack blink + ≤6px pointer parallax (fine-pointer desktop, reduced-motion aware). Blog: «دیدگاه‌ها»/insights renamed to وبلاگ; canonical routes `/blog` + `/blog/[slug]`; `/insights*` → `/blog*` permanent 301s (`public/_redirects`); sitemap/OG/internal links/breadcrumbs canonicalized to /blog; homepage OG card now uses the brand-art geometry instead of a screenshot. | Rendered review of the screenshot-led hero (product proof ≠ brand first impression); founder's core visual concern; duplicate-route risk on /insights | The hero visual returns to photography/screenshots only through a deliberate, documented decision |
| 2026-09 | **Third review: contextual business photography is retired from the public visual language.** Homepage hero/problem/final-CTA photos removed; hero becomes a real audit-UI composition (attention → request → capture → follow-up), problem becomes editorial typography, final CTA becomes a brand-led typographic finish with logo geometry. Photography files + optimize script removed from the production path (retention documented in `docs/IMAGERY.md`). Product screenshots and labeled concept previews remain the proof mechanism. | Rendered review of the photo-led homepage (barbershop/salon photos read as generic stock in both themes; photography does not carry Noveno's product argument); product-led hierarchy is specific, truthful, and on-brand | Photography returns only through a deliberate, documented decision |
| 2026-08-14 | **Founder override (2nd): the flowchart/route language is removed from the public design.** New thesis: Typography + Photography + Real Product Screens + Editorial Numbers (§3). Deleted/rewired: JourneyLine, LeadStatusStrip, SystemArchitectureDiagram, ChannelMap, BeforeAfterJourney, scatter fields, route-band hero, footer mini route, 404 route motif, StepperLine station rail (→ «مرحله X از ۶» + progress bar), thank-you extended route (→ numbered next steps), dashed wireframe concept previews (→ designed concept mocks), ProofTag line-style codes (→ plain text tags), section node markers. Photography introduced (CC0, local, captioned). Hero = photo-led 6/6 split. Work = large preview rows, featured 7/5. Homepage media rhythm ≈6 moments. | Founder verdict on rendered site (diagrams feel technical, small, noisy, non-premium); measured baseline + rebuilt evidence | Any new surface wants a diagram → design review |
| 2026-08-11 | **Visual thesis «مسیر» accepted** — superseded by the 2026-08-14 override above | — | — |
| 2026-08-11 | Type system: Estedad + Vazirmatn, variable, self-hosted ≈165KB | License research; measured subsets | License terms change |
| 2026-08-13 | `text-faint` light darkened `#68736d` → `#66716b` (4.45:1 → 4.58:1 on soft) | Computed WCAG ratios | Token value changes |
| 2026-08-11 | Semantic tokens per §6 with verified AA contrast; buttons use dark ink on green | Computed ratios | Token value changes |
| 2026-08-11 | Light = Workday paper-and-ink; Dark = Ops Room; shared roles, theme-specific depth | Two complete designs | — |
| 2026-08-14 | English-only NOVENO wordmark (mark + wordmark, no Persian wordmark in the lockup); Persian «نوونو» in copy/titles/aria-labels | Commits e6cda4d + add6fe2 | Founder wants the Persian wordmark |
| 2026-08-11 | Motion: state feedback only; hero photograph needs no entrance animation; reduced-motion = static | Spec §58; QUALITY gates | — |
| 2026-08-11 | Implementation decisions: 404 route grammar, JourneyLine as CSS flex, dual-SVG diagrams, header CTA variants — **all superseded by the 2026-08-14 override** | — | — |
| 2026-08-14 | Slice-2 form decisions: FormField/Select/MultiSelect; client-driven progress states; validation/error copy; Turnstile explicit render; thank-you direct-visitor guard `[data-audit-done]` (retained) | Browser evidence; trust-boundary tests | — |
| 2026-08-21 | Work filter: client-side industry filter (query-param hydrated, progressive enhancement, ~60 LOC) — editorial rhythm preserved, URL shareable. | Plan 030 spike (Options A vs B/C), 6 work entries distinct `industry` values | When `industry` becomes enum, replace distinct-set with enum |
| 2026-06 | Light/dark color anchors; Persian-first RTL; system color-scheme default; no theme flash | Accepted bootstrap | — |

## 17. Decisions intentionally deferred (genuinely)

- Hero headline choice (Spec §11.2 candidates) — business/copy decision; the type treatment fits both.
- Audit free-vs-paid policy; prices on site — business decisions.
- Photography subjects (café, gym, workshop) — photography is retired from the public visual language (third review, §3.5); the CC0 source set and its retrieval path are recorded in `docs/IMAGERY.md` should a deliberate decision ever bring photography back.
- Exact component markup/class naming, form field micro-interactions beyond §11 — build.
