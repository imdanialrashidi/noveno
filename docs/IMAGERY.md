# Imagery Registry — Noveno Website

Every substantial image shipped in `public/images/` with its source, license, and processing. Policy (docs/DESIGN.md §9, third review 2026-09): **the public visual language is product-led** — real product screenshots for real work; designed concept previews (labeled) for concepts; typography + restrained brand geometry for editorial moments. **Contextual business photography is retired from the public visual language** (§3.5). No hotlinked remote images.

## Retired photography — retirement and retention record (2026-09)

The following CC0 photographs were part of the 2026-08-14 image-led editorial system and are **no longer part of the production visual language**:

| File | Source | License | Reason for retirement |
|---|---|---|---|
| `barbershop-workday-{1600,800}.{avif,webp}` | [Barbershop In Iran 02.jpg](https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_02.jpg), Mostafa Meraji | CC0 1.0 | Homepage hero photograph — replaced by the real audit-UI composition |
| `salon-workday-{1600,800}.{avif,webp}` | [A beauty salon in Iran, Mashhad … 03.jpg](https://commons.wikimedia.org/wiki/File:A_beauty_salon_in_Iran,_Mashhad,_Free_Photo_Wikipedia,_Mostafa_Meraji_03.jpg), Mostafa Meraji | CC0 1.0 | Homepage problem-section photograph — replaced by editorial typography |
| `workday-close-{1600,800}.{avif,webp}` | [Barbershop In Iran 04.jpg](https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_04.jpg), Mostafa Meraji | CC0 1.0 | Homepage final-CTA photograph — replaced by the brand-led typographic finish |

**Decision (docs/DESIGN.md §3.5, §16):** contextual photography does not carry Noveno's product argument and reads as generic stock; product/UI evidence, typography, and restrained brand geometry replace it as the visual backbone.

**Retention decision:** the binary files and the processing script (`scripts/optimize-photography.py`) were **deleted from the repository**; the source URLs above remain the retrieval path if photography ever returns through a deliberate, documented design decision. `scripts/optimize-work-previews.py` remains for product screenshots. The historical provenance record was kept in the 2026-08-14 report and this table.

## Real product screenshots — `public/images/work/`

Captured with Playwright from this repository's own production build (`astro build` + `astro preview`) at 1440×900, light theme; processed with `scripts/optimize-work-previews.py` (WebP q80, native + half size; AVIF is NOT used for screenshots — measured saving was ≈9% on text-bearing UI, below the quality/benefit bar).

| File | Source | Captured | Used where |
|---|---|---|---|
| `noveno-website-hero.webp` / `-800.webp` | `/` homepage viewport, 1440×900 | 2026-09 (product-led build) | Work section preview + `/work` featured row + `/work/noveno-website` hero (LCP, preload + `fetchpriority=high`) |
| `noveno-website-audit.webp` / `-800.webp` | `/audit` at step ۱ (business), 1440×900 | 2026-09 (product-led build) | Homepage hero composition + system section figure + `/work/noveno-website` detail |
| `noveno-website-audit-channels.webp` / `-800.webp` | `/audit` at step ۲ (channels), 1440×900 | 2026-09 (product-led build) | Homepage system section figure (channel capture with selected chips) |

Other real-project previews (`mobile-khorsandi-hero`, `elsa-hamrah-hero`, `php-ielts-house-hero`, `isbatab-hero`, `danial-rashidi-portfolio-hero`) are captures of the public delivered sites via thum.io (see `public/images/work/SOURCES.md`); refresh with `bash scripts/refresh-portfolio-previews.sh` (downloads 1440×900, then the same Pillow optimizer emits the WebP pair).

These screenshots are real proof of real projects and are re-captured whenever the site's design changes.

## Concept previews

Concepts (`clinic-acquisition-concept`, `language-school-concept`) use **no image files**: `ConceptPreview.astro` renders a designed page mockup (tokens + Persian UI labels) always labeled «نمونه نمایشی — سناریوی مفهومی». Nothing fabricated is presented as real.

## Social cards

Build-time generated PNGs (1200×630) by `scripts/generate-og-images.py` (Pillow + raqm; Noto Sans Arabic, brand tokens from docs/DESIGN.md §6):

| File | Card | Visual |
|---|---|---|
| `public/og.png` | Default / homepage card | NOVENO wordmark + headline + real audit-UI screenshot panel |
| `public/og/work.png` | `/work` index | Wordmark + section title + featured work preview |
| `public/og/work/{slug}.png` | `/work/{slug}` | Wordmark + project title + that project's real preview |
| `public/og/insights.png` | `/insights` index | Wordmark + «دیدگاهها» title + typographic card |
| `public/og/insights/{slug}.png` | `/insights/{slug}` | Wordmark + article title + category chip (per-article typographic card) |

Generated before every build (`npm run build` prebuild hook), committed so `astro dev` works without a build step. Page metadata references them via `og:image` (BaseLayout `ogImage` prop); `public/_headers` serves `/og/*` with short-lived caching so social crawlers re-fetch after content changes.

## Replacing product screenshots (founder workflow)

```bash
# capture a fresh screenshot of the audit form at 1440×900 (light theme),
# then process it into the WebP pair:
python3 scripts/optimize-work-previews.py --input shot.png --name noveno-website-audit
npm run build   # regenerates the content-hashed image manifest
```

- Screenshots are re-captured whenever the site's design changes so work previews always show the real current build.
- `npm run build` re-hashes the files (content-addressed URLs, `scripts/build-image-manifest.mjs`) so visitor caches invalidate correctly — `immutable` caching on `/images/*` stays safe.

After replacing screenshots, update (truthfulness contract):

1. **Alt text + captions** in `src/pages/index.astro` and `src/data/work-previews.ts` — describe the NEW surface.
2. **This registry** — source, capture date, processing for each changed role.
3. Review the rendered result in the browser (light + dark, mobile + desktop) before deploying.
