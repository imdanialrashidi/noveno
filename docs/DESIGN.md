# Product Design Contract — Noveno Website

Visual and interaction source of truth shared by design, implementation, browser QA, and review. This file records the **accepted visual direction** (locked at `/design`, 2026-08-11). The thesis, tokens, composition, motion, and proof plan below are the contract; later `/build-ui` and `/design-review` work must implement this direction, not invent a new one. Changes require a deliberate, documented decision.

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

## 3. Accepted visual thesis

> **«مسیر» (The Path) — The Noveno website is drawn as an acquisition path made visible.**
> Scattered attention enters as a set of points; the site draws the single structured route that turns those points into a captured, followed-up lead. Every diagram on the site is a route, the primary CTA is the next station on the route, and the audit form is a walk along the route.

The site itself demonstrates the product idea (Spec §83): visitors see scatter become order. The visual system is a **route language**, not a decoration layer: line style, node shape, and station sequence all carry meaning, and the same grammar is reused from the hero to the thank-you page.

**What it must feel like:** calm, precise, premium, business-like — a well-run operation, not a campaign.
**What it must never look like:** generic agency/SaaS template, decorative dashboards, fake metrics, glass/gradient/neon effects, oversized empty hero, stock team photography, animation as spectacle.

### Why this direction (and what was rejected)

| Direction explored | Verdict | Reason / what was absorbed |
|---|---|---|
| **A. «مسیر» — the acquisition path** (scatter → route → captured lead) | **ACCEPTED** | The only direction that literally draws the product's core transformation (Spec §3.3, §46); RTL-native (a right-to-left route); works for the spec's business components (Spec §57); inherently honest because it is structural, not decorative. |
| B. «دفتر عملیات» — operations-ledger aesthetic (ruled tables, status strips, checklists) | Rejected as the dominant thesis | Reads utilitarian and cold; risks feeling like a tool vendor. Its best device — the **lead status strip** — is absorbed as one of the four reusable patterns (§4.1 item 4). |
| C. «نقشه سیستم» — engineering-schematic aesthetic (blueprint grid, node-edge diagrams) | Rejected as the dominant thesis | Tech-first reading conflicts with business-first positioning (DNA §19). Its discipline — monoline strokes, geometric node language, annotation callouts — is absorbed into the rendering rules of the accepted patterns. |

This is a rejection record, not a menu: direction A is the single accepted thesis.

### One justified aesthetic risk

**The site commits to looking like the system it sells.** Page chrome borrows the route grammar (section markers, ruled diagram wells, the solid/dashed honesty code). The risk: over-application would make the site feel technical or gimmicky. Mitigation is a hard rule: the route language appears in exactly **five places** — hero diagram, system-model diagram, process diagram, audit progress, and proof-type line styles — plus one small square node marker on section headers. Everything else stays quiet editorial. If a new surface cannot point to one of the five, it does not get the language.

## 4. Signature visual language — the Journey Line

**Signature element: the Journey Line** — a right-to-left monoline route with stations, drawn as inline SVG (static markup, no runtime library). It recurs in four reusable patterns; the fifth motif (the proof line-style code) is a semantic rule applied to all of them.

### 4.1 The four reusable patterns

All four are static SVG (or CSS for the status strip). None shows fictional metrics; diagram labels are real Persian nouns from the spec. Where a pattern would tempt fake numbers, it shows labeled stations instead.

1. **JourneyLine — مسیر (the route).** A horizontal RTL flow of stations connected by a 2px line: `توجه ← اقدام ← ثبت ← پیگیری ← نتیجه` (hero, Spec §11.5) or the six-stage model `جذب ← متقاعدسازی ← اقدام ← ثبت ← پیگیری ← یادگیری` (Spec §13.3) or the five-stage process `بررسی ← طراحی ← اجرا ← اندازهگیری ← بهبود ↺` (Spec §24). Variants: **full line** (current state), **dashed extension** (recommended/future state), **loop-back arrow** (process cycle).
2. **BeforeAfterJourney — قبل و بعد.** Scatter state vs. structured state, shown side by side: a loose cloud of labeled dots (اینستاگرام، گوگل، معرفی، تماس…) collapsing into one ordered route. Used for problem recognition (Spec §12) and case-study "previous journey → what changed" (Spec §21.4–21.5).
3. **ChannelMap — نقشه کانالها.** Channels as labeled dots on the entry side, converging through a single gate (صفحه/سایت، فرم/تماس/واتساپ) into the route. Used in the hero, system-model section, and audit step 2 (channel selection, Spec §31 Step 2).
4. **LeadStatusStrip — نوار وضعیت.** A compact horizontal status row `جدید ← تماسگرفتهشده ← واجدشرایط ← برندهشده/ازدسترفته` with one active position, rendered in CSS. Used for proof categories, case-study outcomes, and the conceptual "what happens after you submit" strip. It is the honesty device: statuses are real states, never invented percentages.

### 4.2 Geometry rules (the "square and circle" code)

Rooted in the logo's angular N and the geometric construction principle of the Kufic-Banna'i tradition (see §5.5) — **squares are system, circles are people/attention, the line is the path**:

- **Square nodes (4–8px, radius 0–1px)**: system stations — page, form, lead record, follow-up. A square node is "a thing Noveno builds".
- **Circle dots (3–6px)**: attention/channels — a dot is "attention that has not become a record yet".
- **Line**: 1.5–2px monoline connectors; **solid = real/current**, **dashed = demo/recommended/future** (also used for the process loop-back and any "proposed" state). Arrowheads only where direction is not obvious; RTL flow always right-to-left.
- **Grid**: diagram wells sit on a 4px base grid; optional 24px dot-grid background only inside diagram wells, never on page backgrounds (the dot grid must read as "scatter paper", not texture).
- **Labels**: 12–13px Estedad 500, always adjacent to the node it describes, with a 4px gap; never inside tiny nodes; callout annotations ("نمونه رابط سیستم" for any concept UI, Spec §11.5) as small footnote labels, never decorative captions.

### 4.3 Proof integrity made visible — the line-style code

Proof type is encoded in **line style + label**, not color alone (WCAG: no color-only meaning):

| Type | Line code | Label / treatment | What may be shown |
|---|---|---|---|
| **مطالعه موردی (Case Study)** | Solid line, filled square stations, evidence footnotes | Small tag «مطالعه موردی»; measured metrics only, each with source/limitation footnote affordance (Spec §21.7–21.8, §66) | Real outcomes with evidence context |
| **پروژه (Project)** | Solid line, hollow square stations | Tag «پروژه»; line ends at «اجرا» with the honest marker «نتیجه: در دست اندازهگیری / نامشخص» | Real implementation, no outcome claims |
| **مفهوم (Concept)** | **Dashed line**, hollow stations, corner tag «نمونه نمایشی — سناریوی مفهومی» | Goals phrased «هدف طراحی» / «KPI پیشنهادی» (Spec §19) | Design goals, never results |

**Solid = real. Dashed = demo.** This is the site's honesty grammar; it appears in the hero, proof section, work grid, and case-study pages. Any fictional interface preview carries the fixed label «نمونه رابط سیستم» (Spec §11.5).

## 5. Typography — Persian as a first-class brand decision

### 5.1 Decision, source, license

| Role | Family | Source | License | Weight axis |
|---|---|---|---|---|
| Display / UI / data | **Estedad** (استعداد) | npm `@fontsource-variable/estedad` v5.3.0; upstream GitHub `aminabedi68/Estedad`; also on Google Fonts | **SIL OFL 1.1** (free for commercial web use, self-hostable, redistributable) | wght 100–900, variable |
| Body | **Vazirmatn** (وزیرمتن) | npm `@fontsource-variable/vazirmatn` v5.3.0; upstream GitHub `rastikerdar/vazirmatn` v33.003; also on Google Fonts | **SIL OFL 1.1** | wght 100–900, variable |

Rationale:

- **Estedad display** — designed for screen use; compact, low-contrast, geometric forms with a slight squareness that echoes the logo mark; less ubiquitous than Vazirmatn, so headings read as deliberate rather than default-Persian-web. Weight 700–900 for headlines.
- **Vazirmatn body** — the most battle-tested Persian text face; proven readability for paragraphs, generous joining, tuned dots and diacritics; weight 400/500 for copy, 600 for emphasis.
- Both include Latin (the «NOVENO» wordmark renders in Estedad), both render **Persian digits ۰–۹**, both are variable (one file covers the whole weight range → best performance).

### 5.2 Type roles and scale

Base: 16px; scale in `rem`. Line-heights are generous because Persian joins four levels (baseline, ascenders of گ/ک/ی, descenders of ی/پ, and the tail of ن/چ) and needs room.

| Role | Family | Size / line-height | Weight | Use |
|---|---|---|---|---|
| Display (hero) | Estedad | 48–64px desktop / 34–40px mobile · lh 1.2–1.3 | 800 | Homepage hero only |
| H2 (section) | Estedad | 34–44px desktop / 26–30px mobile · lh 1.3 | 700 | Section titles |
| H3 | Estedad | 20–24px · lh 1.5 | 600 | Sub-blocks, offer names |
| Lead | Vazirmatn | 18–20px · lh 1.9 | 400 | Hero support, section intros |
| Body | Vazirmatn | 16–18px · lh 1.9 | 400/500 | Paragraphs |
| UI / label | Estedad | 14px · lh 1.7 | 500 | Buttons, nav, form labels, diagram labels |
| Caption / footnote | Estedad | 12–13px · lh 1.6 | 500 | Proof footnotes, «نمونه رابط سیستم», meta |
| Data / metric | Estedad | same size as context · lh 1.4 | 600 | Real measured values, statuses |

Spec §47 guidance (hero 48–64, H2 34–44, body 16–18, mobile hero 34–40) is satisfied. **No letter-spacing on Persian text** (breaks joining); tracking 0 for display, −0.01em allowed at 48px+; the Latin «NOVENO» wordmark may use modest +0.02–0.04em tracking. Headlines wrap at 2 lines desktop / 3 lines mobile max; both approved hero candidates (§11.2) fit this treatment — the copy choice stays a business decision.

### 5.3 Fallback strategy (CLS-safe)

- Stack: `font-family: "Estedad", "Vazirmatn", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif;` — with `"Vazirmatn"` first for body roles: `"Vazirmatn", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`.
- `font-display: swap` for both faces; **preload only `estedad-arabic`** (the hero headline is the LCP text); Vazirmatn loads via CSS at first text paint.
- Declare local fallback faces with `@font-face { src: local("Tahoma")…; size-adjust; ascent-override; descent-override; }` and put them behind the webfonts so a slow font load degrades to a metric-matched Tahoma instead of a layout shift (CLS target stays ≤ 0.1, §14).
- Blocking is avoided: no `display: block` font loading, no Font Loading API dependency; if fonts fail (filtered CDN etc.), the site is fully readable in the fallback stack (Spec §50, §64.2 — self-hosting also removes CDN dependency entirely).

### 5.4 Performance (measured, 2026-08-11)

Variable woff2 subsets from `@fontsource-variable/*` v5.3.0:

| File | Size |
|---|---|
| `estedad-arabic-wght-normal.woff2` | 57.0 KB |
| `estedad-latin-wght-normal.woff2` | 27.2 KB |
| `vazirmatn-arabic-wght-normal.woff2` | 46.3 KB |
| `vazirmatn-latin-wght-normal.woff2` | 34.5 KB |
| **Total (all subsets)** | **≈ 165 KB** |

Budget: **≤ 200 KB woff2 total**; skip `latin-ext`/`vietnamese` subsets (unused). Serve from `public/fonts/` with `Cache-Control: immutable` via Cloudflare Pages; no external font CDN. Two variable files replace ~18 static weights — this is the smallest complete type system available at this quality level.

### 5.5 What was deliberately rejected

- **Morabba (مربع)** — the aesthetic ideal (geometric, Kufic-Banna'i construction, square/circle geometry matching the logo) but **commercial**: paid web license (€149/domain via NoonFont; ~698,000 toman via Fontiran); the "free" tier is desktop personal use only. Rejected on license; **its geometric construction principle is adopted** as the diagram grammar (§4.2) — the idea is free, the font is not.
- **Fontiran families (IranYekan, IranSans, Dana, Anjoman)** — commercial with ambiguous redistribution terms. Rejected.
- **Vazirmatn-only system** — rejected: a single family reads as the default Persian web; the two-family hierarchy (geometric display + proven text) gives the bespoke edge without license risk.
- **Lalezar / Mikhak / Ravi-class display fonts** — playful or handwriting-flavored; wrong register for calm/business-first.

## 6. Semantic tokens

### 6.1 Color — Light «روز کاری» (Workday)

Semantic roles, values, and **verified WCAG 2.2 contrast** (computed 2026-08-11; faint token re-proved 2026-08-13; re-verify at build with the real stack):

| Token | Value | Used for | Contrast vs canvas (verified) |
|---|---|---|---|
| `canvas` | `#f9fafa` | page background (anchor) | — |
| `surface` | `#ffffff` | form panel, menu, code blocks | — |
| `surface-soft` | `#f1f4f2` | diagram wells, alternating section tint | — |
| `text` | `#070808` | primary text (anchor) | 19.2:1 |
| `text-muted` | `#4c5751` | secondary text | 7.2:1 |
| `text-faint` | `#66716b` | tertiary/labels ≥ 4.5:1 only | 4.9:1 vs canvas; **4.6:1 vs `surface-soft`** (StepperLine rail labels, diagram captions) |
| `text-action` | `#2f7a5e` | active station/link text on soft surfaces | 4.9:1 vs canvas; **4.7:1 vs `surface-soft`** (normal-sized text; distinct from button `primary-active`) |
| `line` | `#dfe3e1` | decorative hairlines/dividers | decorative (not required to identify controls) |
| `line-strong` | `#7e8a83` | **form-control borders**, diagram strokes on light | 3.4:1 (non-text ✓) |
| `primary` | `#679e86` | action fills, active path, buttons (anchor) | button text `#06130d` on it: **6.2:1** |
| `primary-hover` | `#578d75` | button hover | with `#06130d`: 4.9:1 |
| `primary-active` | `#4f8a6f` | pressed | with `#06130d`: 4.7:1 |
| `primary-soft` | `#e3efe9` | selected chips, diagram station fills | with `#0c3d2b`: 10.4:1 |
| `accent` | `#82c4a8` | soft support fills (channel dots, scatter) (anchor) | non-text fill; text on it uses `#0c3d2b` |
| `accent-strong` | `#3b7d61` | green text accents, live/success indicators | 4.7:1 |
| `success` | `#2e7d5b` | success messages/icons | 4.8:1 |
| `danger` | `#b03a34` | errors, destructive | 5.7:1 (white on it: 6.0:1) |
| `focus` | `#2f7a5e` | 2px focus ring | 4.9:1 (non-text ✓) |
| `on-primary` | `#06130d` | text on primary fills (dark ink on green) | see `primary` |

Rule: **the primary button carries dark ink on green** (`#06130d` on `#679e86`), not white — white fails AA at 3.1:1. This also reads calmer than the generic white-on-brand button.

### 6.2 Color — Dark «اتاق عملیات» (Ops Room)

| Token | Value | Used for | Contrast vs canvas (verified) |
|---|---|---|---|
| `canvas` | `#050606` | page background (anchor) | — |
| `surface` | `#0d1110` | raised panels (audit card, menu) | text on it 12.8:1 |
| `surface-soft` | `#101715` | diagram wells | — |
| `text` | `#f7f8f8` | primary text (anchor) | 19.1:1 |
| `text-muted` | `#aab5af` | secondary text | 9.6:1 |
| `text-faint` | `#7f8a84` | tertiary/labels | 5.7:1 |
| `text-action` | `#8fd4b0` | active station/link text | 11.8:1 |
| `line` | `#232b28` | decorative hairlines | decorative |
| `line-strong` | `#8d9a93` | form-control borders, diagram strokes | 6.5:1 (non-text ✓) |
| `primary` | `#619881` | action fills, active path (anchor) | button text `#06130d` on it: **5.7:1** |
| `primary-hover` | `#6fae93` | hover | with `#06130d`: 7.4:1 |
| `primary-soft` | `#173026` | selected chips, station fills | with `#e8f3ed`: 12.4:1 |
| `accent` | `#3b7d61` | fills (anchor) | non-text fill |
| `accent-light` | `#8fd4b0` | green text accents, success indicators | 11.8:1 |
| `success` | `#9dd8b7` | success messages | 12.5:1 |
| `danger` | `#e07b74` | errors | 7.0:1 |
| `focus` | `#6fae93` | 2px focus ring | 7.9:1 (non-text ✓) |
| `on-primary` | `#06130d` | text on primary fills | see `primary` |

**Every role above is a derived tone from the accepted anchors** (`#679e86`/`#619881` primaries, `#add2c2`/`#2d5242` secondaries, `#82c4a8`/`#3b7d61` accents, `#070808`/`#f7f8f8` text, `#f9fafa`/`#050606` canvas) — the anchors remain authoritative; these tokens are the smallest set that makes them usable at AA. No token value may be changed without re-proving contrast against its real usage pair.

### 6.3 Non-color tokens

| Group | Token values |
|---|---|
| Spacing (4px base) | `2 4 8 12 16 24 32 48 64 96 128` px; section rhythm: 96–120px desktop / 64–80px mobile |
| Radius | controls 4px; panels 8px (audit card only); diagram nodes 0–1px; **no pills** (badges 4px) |
| Border | hairline 1px `line`; form controls 1px `line-strong`; focus 2px `focus` + 2px offset |
| Depth | Light: one soft shadow token for the audit panel/menu `0 1px 2px rgba(7,8,8,.06), 0 8px 24px rgba(7,8,8,.08)`; everything else flat. Dark: **no shadows** — elevation via surface tones + 1px top hairline highlight `rgba(247,248,248,.06)` |
| Motion | `--dur-1: 150ms` hover/focus fills; `--dur-2: 250ms` step/accordion; `--dur-3: 400ms` messages; hero draw 700ms; ease `cubic-bezier(.2,.7,.3,1)` |
| Icons | one custom monoline set, stroke 1.5px, square-friendly geometry matching the logo; ≤ 16 icons total; no mixed families |
| Content measure | paragraphs ≤ 66ch (~640px); form column 560px max |

## 7. Themes — two complete designs, one mechanics

### 7.1 Light «روز کاری» (Workday) — complete design

A calm paper-and-ink office: near-white canvas with a faint cool cast, flat editorial sections separated by hairline rules, green reserved for *action and live state*. Diagram wells are `surface-soft` with the 24px dot-grid; the journey line is ink `line-strong` with `primary` for the active segment. Depth is minimal (one shadow for the audit panel). This is not "white mode": it uses flat section rhythm, hairlines, and paper-like wells that the dark theme deliberately does not mirror.

### 7.2 Dark «اتاق عملیات» (Ops Room) — complete design

A quiet operations console: true near-black canvas, panels *lifted by surface tone* (not shadow), hairlines at `#232b28`, and green used two ways — as action fill (buttons, active path) and as **signal** (`accent-light` for status text/indicators). Diagram wells are `#101715` with a slightly brighter dot-grid. Muted text is gray-green rather than a pure gray inversion. This is not "light flipped": depth strategy, green's dual role, and border tones are dark-specific.

### 7.3 Theme behavior (accepted, preserved)

- **Default:** OS preference via `@media (prefers-color-scheme)`; CSS custom properties defined per theme on `:root` (both), overridden by `[data-theme="light"]` / `[data-theme="dark"]` on `<html>`.
- **Persisted override:** explicit user choice only — stored as `noveno-theme` in `localStorage`; removing the choice returns to OS default. Never write the OS default into storage (override must be explicit).
- **No wrong-theme flash:** a tiny inline `<script>` in `<head>` (≈0.4 KB, framework-free) reads `localStorage` **before first paint** and sets `data-theme`; no script = media-query default, which matches the OS anyway. Set `color-scheme` via CSS and `<meta name="color-scheme" content="light dark">`.
- **Accessible toggle:** a real `<button>` in the header, `aria-pressed` reflecting current state, label «حالت روشن / حالت تاریک» (current-state label announced), keyboard operable, ≥44px target; also present in the mobile menu. Theme switch transitions: ≤150ms color transition, none under `prefers-reduced-motion`.

## 8. Composition and layout language

- **Grid:** 12 columns desktop (content max 1200px, within Spec §48's 1180–1240), 4 columns mobile; RTL-native — first column is rightmost. Text measure ≤ 66ch; generous whitespace with consistent vertical rhythm (spec §48).
- **Section composition:** editorial split layouts (50/50, 60/40) alternating; **containers only where grouping or interaction requires them** (audit card, mobile menu, FAQ). No wall of cards: offers are three hairline-separated **route rows**; proof is a list of rows with line-style codes; the work grid uses minimal rows. Section headers carry a small square node marker (4px, `primary`) before the H2 + hairline rule — the only chrome-level route reference.
- **Information density:** business-like, list-forward, prose-limited; diagrams carry the system story. The hero is substantive (headline + support + CTAs + microcopy + a real diagram), not an oversized empty statement; header + hero fit ≈ 85vh.
- **Header:** hairline bottom border; logo mark + «نوونو» wordmark (Estedad 800); nav links Estedad 500 14px; primary CTA button. Desktop: not sticky (calm; the CTA recurs in sections). **Mobile: compact sticky header with the audit CTA always visible** (Spec §49); menu trigger ≤ 44px, no mega-menu (Spec §9.2).
- **Footer:** contact facts always visible — phone 09353598620 (click-to-call), WhatsApp/Telegram, email (Spec §64.1); mini JourneyLine motif; /privacy + /terms links.

## 9. Imagery, icons, art direction

- **Imagery priority (Spec §56):** real system screenshots → real case-study diagrams (in the §4 SVG language) → real business/client imagery with permission → clearly labeled concept UI («نمونه رابط سیستم») → founder photography → stock only if truly necessary. **No stock agency/team photography.** Any photography: muted, consistent grading, generous matte, never decorative filler.
- **Diagrams are the hero medium** — inline SVG, `aria-hidden` with adjacent text equivalent (or a real `<ul>` description where the diagram is informative), no image files for diagrams.
- **Icons:** one custom monoline set (1.5px stroke, geometry consistent with the logo); used only for meaning (phone, WhatsApp, Telegram, check/cross for fit lists, error/warning, chevron).
- **Logo:** reuse `branding_assests/` geometry unchanged (angular N mark). The website SVGs carry a legacy purple fill (`rgb(86,49,165)`) that conflicts with the accepted green anchors — at build, render the mark with the semantic `text`/`primary` token (a color application, not a recreation); **founder confirms this recolor at `/plan`** (recorded in §17). The embedded Tahoma «NOVENO» text in `Logo_Website_SVG.svg` is replaced by Estedad-rendered wordmark text.

## 10. Components and states

Small inventory, mapped from Spec §57; every visible control must work (QUALITY functional completeness):

| Group | Components |
|---|---|
| Layout | Header, MobileMenu, Footer, SectionHeader (node marker), CTASection |
| UI | Button (primary / secondary / ghost), TextLink, ProofTag (3 variants), FormField, Select, MultiSelect (channels), Textarea, FAQItem (accordion), Metric (evidence-bound only) |
| Business | JourneyLine, BeforeAfterJourney, ChannelMap, LeadStatusStrip, SystemArchitectureDiagram, ProofRow (Case/Project/Concept), NextStepsRail, StepperLine (audit progress) |

**Button language:** primary = `primary` fill, `on-primary` ink, 4px radius, min-height 48px; secondary = 1px `line-strong` + `text`; ghost = text link with visible focus. States: default / hover (primary-hover) / focus-visible (2px `focus` ring) / disabled (opacity 45%, not color-only) / pressed (primary-active).

**ProofTag:** the only badge in the system — «مطالعه موردی» (solid), «پروژه» (hollow), «نمونه نمایشی» (dashed) — rendered with the corresponding line-style code; nothing else gets a pill.

**Metric component:** only for evidence-backed values; always paired with its unit, period, source note, and limitation footnote (Spec §66). No standalone floating numbers anywhere.

**Empty/loading states:** static pages have none except — image placeholders (reserved aspect ratio, `surface-soft` wash), form submitting (inline progress), and network failure (see §11). Long-content state: case studies render at 66ch measure with a desktop sticky right rail (journey map + results summary), collapsing to a single column on mobile.

## 11. The /audit journey — visual and interaction treatment

The form is a walk along the route: 6 steps = 6 stations (Spec §31). Page composition: two-column desktop (right: step content; left: quiet explainer + StepperLine rail), single-column mobile. Form card: `surface` panel, 8px radius, 560px measure, `line-strong` field borders.

- **Progress:** StepperLine — stations ۱–۶ with names (کسبوکار ← کانالها ← مشکل اصلی ← ارزش مشتری ← نیاز ← تماس), RTL. Desktop: horizontal line; **complete = filled square + check**, **current = primary outline**, **upcoming = dashed**. Mobile: compact «مرحله ۳ از ۶» + thin 2px progress bar (no tiny tap targets). Progress announces via `aria-live` on step change.
- **Selection (Step 2 channels):** MultiSelect chips — square-ish 4px radius, default `line-strong` outline; selected = `primary-soft` fill + `#0c3d2b` ink + check glyph (shape + check, not color alone); ≥44px targets; keyboard arrow navigation; the selected set echoes into the ChannelMap diagram beside the form (live, ≤ 10 nodes).
- **Validation:** client-side for UX only; server-side is authoritative (ARCHITECTURE). Per-field inline errors on blur/touch with `aria-describedby` linkage, danger color + icon + text (never color-only); step-level message «یک مورد را کامل کنید»; on submit attempt, form-level summary. Error copy is specific and calm: «شماره تماس را وارد کنید» — never technical.
- **Submitting:** primary button → inline progress (spinner + «در حال ارسال…»), disabled, double-submit guarded; progress persists within the step.
- **Success:** → `/audit/thank-you`. The JourneyLine extends: stations ۱–۵ complete + **dashed future stations** «بررسی ← تماس ← گفتگو ← پیشنهاد» with a «شما اینجا هستید» marker (Spec §33); NextStepsRail lists the four next steps; contact fallback row (phone/WhatsApp/Telegram) always visible; optional pointer to a relevant case study. No dead end (Spec §74).
- **Recoverable error (network/server):** inline error banner above the form: «ارسال نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید» + «تلاش دوباره» button; **field values preserved**; never a silent failure (Spec §61). Offline detection (`navigator.onLine`) shows the same banner with the contact fallback emphasized.
- **Long content:** each step stays ≤ 2 short questions; explanatory microcopy is measure-limited; the economics step (Step 4) uses range selects, not free numbers; mobile keyboards optimized (`inputmode="tel"` etc., Persian digits accepted and normalized server-side at build).

## 12. Motion

Restrained; clarifies flow, state, or hierarchy only (Spec §58):

1. **One orchestrated moment:** the hero JourneyLine draws itself once on load (SVG stroke-dashoffset, 700ms) and stations appear in sequence — communicating "the path is being built". Under `prefers-reduced-motion`: fully drawn, no animation.
2. **State feedback:** hover = node/station fill + line segment highlight (150ms); form focus = border + ring transition (150ms); step change = fade + 16px shift (250ms); accordion = max-height/opacity 250ms; success banner = 400ms entrance.
3. **No:** scroll-jacking, parallax, infinite animation, entrance reveals beyond the single hero moment (page scroll adds nothing), full-page theme crossfades (≤150ms color only), motion on every element.
4. Global guard: `@media (prefers-reduced-motion: reduce)` zeroes all durations and disables the hero draw; the site is fully comprehensible and operable with motion off.

## 13. Content voice (design-facing rules)

- Labels are short business nouns; stations are single words (توجه، اقدام، ثبت، پیگیری، نتیجه). Fixed CTA language per Spec §3.5–3.6 («درخواست بررسی مسیر جذب»; «دیدن پروژهها»); hero microcopy «بدون وعده فروش تضمینی؛ ابتدا مسیر فعلی کسبوکار بررسی میشود» (Spec §11.4).
- Prohibited hype per Spec §52.1; preferred framing per §52.2. No guarantee language anywhere, including in diagram labels.
- Buttons describe the action they perform; error/success copy states what happened and what to do next. No decorative copy; every element explains, proves, qualifies, or converts (Spec §1.2, §82).

## 14. Quality budgets (design constraints)

- **Accessibility:** WCAG 2.2 AA — all token pairs above verified ≥4.5:1 text / ≥3:1 large + non-text; keyboard + visible focus everywhere; labels on every input; error messages linked to fields; reduced-motion honored; no color-only meaning (line-style code + labels); reflow at 320px; usable at 200% zoom; tap targets ≥44px.
- **Performance (design-relevant):** fonts ≤ 200KB (measured ≈ 165KB); interactive JS ≤ 15KB gzip (theme toggle, menu, form validation, optional line-draw observer — no libraries); diagrams are inline SVG, zero image cost; images AVIF/WebP + `srcset` + lazy below fold; third-party = Cloudflare Web Analytics only; self-hosted fonts/scripts (Spec §50, §64.2). CWV targets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (p75), with an accepted lab budget at build (QUALITY).
- **Themes:** both themes must be fully token-driven (no component-local colors); theme switch ≤150ms, no flash, persisted explicit override only.

## 15. Screen-level acceptance — what /build-ui and /design-review must prove

Evidence per `browser-qa` + the visual-quality rubric: screenshots with state provenance (route, viewport, theme, locale fa-RTL), accessibility snapshots, reduced-motion check, network panel, lab CWV on a throttled profile. Flagship bar: average craft ≥ 3.25, no dimension < 3, signature scores ≥ 3/4 on specificity and execution.

| # | Screen / state | Critical states | Viewports · themes | Proof required |
|---|---|---|---|---|
| 1 | Homepage hero | journey line drawn; headline (both approved candidates fit); dual CTA; microcopy; reduced-motion variant | 1440 + 390 · light + dark | Screenshots ×2 viewports ×2 themes; motion-on/off |
| 2 | Problem recognition | before/after scatter→route diagram; mobile recomposition (stacked) | 1440 + 390 · both themes | Screenshots |
| 3 | System model | 6-station JourneyLine desktop / vertical spine mobile; channel map | 1440 + 390 · both themes | Screenshots; RTL direction check |
| 4 | Offers + process | 3 route rows; 5-stage loop diagram | 1440 + 390 | Screenshots |
| 5 | Proof section + /work | three proof types visually distinct (solid/hollow/dashed + tags); no fake metrics | 1440 + 390 | Screenshots; tag/line-code contrast evidence |
| 6 | Case study page | long content; sticky rail desktop; metrics with source + limitation footnotes; mobile single column | 1440 + 390 | Screenshots; 200% zoom spot-check |
| 7 | Concept page | dashed treatment + «نمونه نمایشی» + «هدف طراحی/KPI پیشنهادی» labels | 1440 + 390 | Screenshots |
| 8 | /audit | step default, selection state, validation errors, submitting, network-error + retry with values preserved, success | 1440 + 390 + 320 · both themes | Full browser journey; error-state screenshots; keyboard + `aria` snapshot |
| 9 | /audit/thank-you | completed stations + dashed next steps + «شما اینجا هستید» + contact fallback | 390 + 1440 | Screenshots |
| 10 | Theme behavior | OS-dark default, persisted override, toggle a11y, no wrong-theme flash on reload | 390 + 1440 | Browser evidence per `browser-qa` (flash test) |
| 11 | Contact + footer | click-to-call, messaging links, contact redundancy visible | 390 | Screenshots |
| 12 | Global shell | header (desktop non-sticky, mobile sticky with CTA), menu, focus order, RTL | 390 + 1440 | Accessibility snapshot |

## 16. Decisions intentionally deferred (genuinely)

- Hero headline choice (Spec §11.2 candidates) — business/copy decision; the type treatment fits both.
- Audit free-vs-paid policy; prices on site — business decisions (Spec §15, §39).
- Logo recolor confirmation (green tokens vs legacy purple) — founder confirmation at `/plan` (default: recolor, geometry unchanged).
- Exact component markup/class naming, Tailwind config, form field micro-interactions beyond §11 — `/plan`/build.
- Diagram SVG asset production details (viewBox strategy, vertical variants) — build, against §4.2 rules.

## 17. Decision log

| Date | Decision | Evidence / rationale | Revisit when |
|---|---|---|---|
| 2026-08-11 | **Visual thesis «مسیر»** accepted; route language in exactly 5 places; square=system / circle=attention / solid=real / dashed=demo | Product transformation (Spec §3.3), business-component list (Spec §57), anti-template review; alternatives B/C rejected (see §3) | A new surface needs the language → design review |
| 2026-08-11 | **Type system:** Estedad (display/UI) + Vazirmatn (body), both SIL OFL 1.1, variable, self-hosted, ≈165KB | License research (GitHub/npm/Google Fonts, 2026-08-11); Morabba rejected — commercial; measured subset sizes | License terms change; a licensed Morabba is purchased |
| 2026-08-13 | `text-faint` light darkened `#68736d` → `#66716b` after independent design review measured 4.45:1 on `surface-soft` (below the 4.5:1 AA floor); dark theme unchanged | Computed WCAG 2.2 ratios (2026-08-13): light 4.6:1 on soft / 4.9:1 on canvas / 5.1:1 on surface; dark 5.1:1 on soft / 5.7:1 on canvas | Token value changes → re-prove contrast |
| 2026-08-11 | Semantic tokens per §6 with verified AA contrast; buttons use dark ink on green (white fails 3.1:1) | Computed WCAG 2.2 ratios (2026-08-11) | Token value changes → re-prove contrast |
| 2026-08-11 | Light = paper-and-ink Workday; Dark = surface-lifted Ops Room; shared roles, theme-specific depth/green roles | Two complete designs, not inversions (§7) | — |
| 2026-08-11 | Proof integrity = line-style code (solid/hollow/dashed) + tags; «نمونه رابط سیستم» fixed label | Spec §18–19, §11.5; no color-only meaning | — |
| 2026-08-11 | Logo geometry reused; legacy purple fill replaced by semantic tokens at build; Tahoma wordmark → Estedad | `branding_assests/` audit; anchors are green | Founder confirmation at /plan |
| 2026-08-11 | Motion: one hero draw + state feedback only; reduced-motion = static | Spec §58; QUALITY hard gates | — |
| 2026-08-11 | **Implementation decisions (Slice 1 build, accepted within contract):** (1) 404 error state uses the route grammar as a deliberate sixth place — a broken dashed path ending at a «۴۰۴» station — because the error state is semantically the path stopping; documented here per §3's change rule. (2) The JourneyLine pattern component renders as a CSS flex route (not SVG) so the horizontal→vertical-spine recomposition (matrix screen 3) is RTL-native and label sizes stay at 12–13px at all viewports; geometry, line-style code, and labels follow §4.2 exactly; the hero/system diagrams remain inline SVG. (3) Hero + system ChannelMap and SystemArchitectureDiagram ship dual static SVG compositions (horizontal desktop / vertical mobile) so diagram labels hold ≥12px at 390px (§4.2 label rule). (4) Header CTA shows the full fixed language «درخواست بررسی مسیر جذب» at ≥sm and the spec §9.1 compact form «درخواست بررسی» below sm. | Browser evidence (computed sizes at 1440/390/320) + reviewer findings; DESIGN §15 proof matrix | Revisit when a new surface needs the route language → design review |
| 2026-06 (bootstrap) | Light/dark color anchors as recorded in §6 | Accepted bootstrap prompt | — |
| 2026-08-14 | **Visual elevation pass:** the route thesis now operates as a page-level editorial composition, not a repeated diagram. The homepage opens with an ink-and-paper split hero, a numbered route index, and a single large acquisition map; later sections alternate between quiet editorial, full-bleed operational green, and compact evidence bands. Work uses a proof index with type-specific rails, and audit uses a persistent operational rail beside a focused station surface. | Baseline browser render showed a predictable heading/paragraph/grid rhythm, undersized first viewport, low visual tension, and proof/audit surfaces that read as generic content/form templates. New geometry keeps square system nodes, circle attention dots, solid/dashed truth code, Persian-first typography, and no fabricated metrics while changing composition, density, and atmosphere substantially. | Revisit after the first post-launch conversion and proof-data review |
| 2026-06 (bootstrap) | Persian-first RTL, system color-scheme default, persisted override, no theme flash | Accepted bootstrap prompt | Implementation validates |
| 2026-08-11 (Slice 2 build, accepted within contract) | **(1) Form component set:** `FormField`/`Select`/`MultiSelect` built for the audit journey; the inventory's `Textarea` deferred until a field needs free text (no audit field does — no dead code). **(2) StepperLine state is client-driven:** the component renders build-time `current`; the audit script flips `data-state` (complete/current/upcoming) on stations and the mobile counter/bar — one visual contract, one markup source. **(3) Step/validation copy** follows §11 exactly («ارسال نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید» + تلاش دوباره; offline variant emphasizes contact fallback; «بررسی امنیتی ناموفق بود» for Turnstile; «یک مورد را کامل کنید» step message). **(4) Turnstile renders inside the contact station** (fresh token at submit), re-renders on theme change, resets on retry. **(5) Thank-you route:** the six completed audit stations + dashed future stations «بررسی ← تماس ← گفتگو ← پیشنهاد» + «شما اینجا هستید» marker; the direct-visitor note hides before first paint via a head-script attribute (zero CLS on the submit path). **(6) Step-1 economics:** optional range select (۵–۲۰ میلیون تومان style ranges); skipping is allowed (privacy: no forced financial disclosure). | Browser evidence at 1440/390/320 both themes; CLS measured ≤ 0.03; trust-boundary tests | Revisit when a new surface needs the route language → design review |
| 2026-06 (bootstrap) | Brand assets reused from `branding_assests/` (geometry) | Accepted bootstrap prompt | Asset pipeline at build |
