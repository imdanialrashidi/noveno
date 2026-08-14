# Photography provenance

All files in this directory: **Wikimedia Commons**, photographer **Mostafa Meraji**, license **CC0 1.0** (public-domain dedication).

| File | Source page | Original |
|---|---|---|
| `barbershop-workday-*` | https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_02.jpg | 2000×1500 |
| `salon-workday-*` | https://commons.wikimedia.org/wiki/File:A_beauty_salon_in_Iran,_Mashhad,_Free_Photo_Wikipedia,_Mostafa_Meraji_03.jpg | 4000×2666 |
| `workday-close-*` | https://commons.wikimedia.org/wiki/File:Barbershop_In_Iran_04.jpg | 2000×1500 |

Processing (regenerated 2026-08-14 performance pass): center crops — hero 3:2, problem 16:10, CTA 16:9 — via `scripts/optimize-photography.py` (Pillow), AVIF q44 / WebP q78, method 6, at 1600w + 800w. Hashed delivery copies are build artifacts (see `docs/IMAGERY.md`).

Replacing a photo: run `scripts/optimize-photography.py --<role> <source>` (see `docs/IMAGERY.md` §replacement), then update this table and the alt/caption text in `src/pages/index.astro`.
