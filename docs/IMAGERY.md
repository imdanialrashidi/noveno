# Imagery Registry — Noveno Website

Every substantial image shipped in `public/images/` with its source, license, and processing. Policy (docs/DESIGN.md §9): real product screenshots for real work; designed concept previews (labeled) for concepts; CC0-licensed contextual photography, stored locally, captioned with provenance. No hotlinked remote images.

## Photography — `public/images/photography/`

All photographs are from **Wikimedia Commons**, photographer **Mostafa Meraji**, license **CC0 1.0** (public-domain dedication — no attribution required; captions credit the photographer anyway, per the editorial captions policy).

| File (variants) | Source file | Original size | Crop / ratio | Used where |
|---|---|---|---|---|
| `barbershop-workday-{1600,800}.{avif,webp}` | [Barbershop In Iran 02.jpg](https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_02.jpg) | 2000×1500 | center 3:2 (1600×1067 / 800×533) | Homepage hero (LCP, AVIF preload, `fetchpriority=high`), OG poster |
| `salon-workday-{1600,800}.{avif,webp}` | [A beauty salon in Iran, Mashhad, Free Photo Wikipedia, Mostafa Meraji 03.jpg](https://commons.wikimedia.org/wiki/File:A_beauty_salon_in_Iran,_Mashhad,_Free_Photo_Wikipedia,_Mostafa_Meraji_03.jpg) | 4000×2666 | center 16:10 (1600×1000 / 800×500) | Homepage problem section |
| `workday-close-{1600,800}.{avif,webp}` | [Barbershop In Iran 04.jpg](https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_04.jpg) | 2000×1500 | center 16:9 (1600×900 / 800×450) | Homepage final CTA (photo finish) |

Processing: `scripts/optimize-photography.py` (Pillow); center crops only (no creative reframing); AVIF q44 + WebP q78, method 6; `width`/`height` attributes set in markup; lazy below the fold (hero eager).

Selection evidence (2026-08-14, no-vision session): candidates ranked by computed sharpness (Laplacian variance at fixed 800px), exposure (luminance), and saturation; the sharpest, best-lit frames per subject were chosen. Photographic *aesthetic* judgment remains a founder-review item (see report).

## Replacing homepage photography (founder workflow)

One command, no image knowledge required:

```bash
python3 scripts/optimize-photography.py \
    --hero    path/to/new-hero.jpg \
    --problem path/to/new-problem.jpg \
    --cta     path/to/new-cta.jpg
npm run build   # regenerates the content-hashed image manifest
```

- Roles are fixed: **hero ≈ 3:2** (1600×1067 + 800×533), **problem = 16:10**, **final CTA = 16:9**; the script center-crops, resizes, and emits **AVIF + WebP** for every variant with visually sensible quality (AVIF q44, WebP q78, method 6).
- Filenames stay deterministic (`barbershop-workday-*`, `salon-workday-*`, `workday-close-*`) — the site markup never changes when photography is swapped.
- The script **refuses** to ship oversized output: sources must be ≥1600px, outputs are asserted ≤500 KB, and only resized variants are written — a multi-megabyte original can never end up in `public/images/`.
- `npm run build` re-hashes the files (content-addressed URLs, `scripts/build-image-manifest.mjs`) so visitor caches invalidate correctly — `immutable` caching on `/images/*` stays safe.
- Any role may be omitted (`--hero` alone is fine). Add `--dry-run` to preview.

After replacing photos, update (truthfulness contract):

1. **Alt text + captions** in `src/pages/index.astro` — `HERO_PHOTO`, `PROBLEM_PHOTO`, and the `CTASection media` props — describe the NEW subject; keep the caption credit format («عکس: … (مجوز)»).
2. **This registry** — source URL, license, photographer, crop, processing date for each changed role.
3. **`public/images/photography/PROVENANCE.md`** — same rows.
4. Review the rendered result in the browser (light + dark, mobile + desktop) before deploying.

## Real product screenshots — `public/images/work/`

Captured with Playwright from this repository's own production build (`astro build` + `astro preview`) at 1440×900, light theme; processed with `scripts/optimize-work-previews.py` (WebP q80, native + half size; AVIF is NOT used for screenshots — measured saving was ≈9% on text-bearing UI, below the quality/benefit bar).

| File | Source | Captured | Used where |
|---|---|---|---|
| `noveno-website-hero.webp` / `-800.webp` | `/` homepage viewport, 1440×900 | 2026-08-14 (post-redesign build) | Work section preview + `/work` featured row + `/work/noveno-website` hero (LCP, preload + `fetchpriority=high`) |
| `noveno-website-audit.webp` / `-800.webp` | `/audit` at step ۲ (channels), 1440×900 | 2026-08-14 (post-redesign build) | Homepage system section figure + `/work/noveno-website` detail |

Other real-project previews (`mobile-khorsandi-hero`, `elsa-hamrah-hero`, `php-ielts-house-hero`, `isbatab-hero`, `danial-rashidi-portfolio-hero`) are captures of the public delivered sites via thum.io (see `public/images/work/SOURCES.md`); refresh with `bash scripts/refresh-portfolio-previews.sh` (downloads 1440×900, then the same Pillow optimizer emits the WebP pair).

These screenshots are real proof of real projects and are re-captured whenever the site's design changes.

## Concept previews

Concepts (`clinic-acquisition-concept`, `language-school-concept`) use **no image files**: `ConceptPreview.astro` renders a designed page mockup (tokens + Persian UI labels) always labeled «نمونه نمایشی — سناریوی مفهومی». Nothing fabricated is presented as real.

## Social

`public/og.png` (1200×630, ~390 KB) generated by `scripts/generate-og-image.py`: brand wordmark + promise line + CTA + the `barbershop-workday` photograph (same art direction as the hero).
