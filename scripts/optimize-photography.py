#!/usr/bin/env python3
"""
Noveno homepage photography pipeline — founder-friendly, one command.

Regenerates the three homepage photography roles from founder-provided
source photos and produces every production variant the site needs:

    hero    → 3:2  (1600×1067 + 800×533)  → barbershop-workday-{1600,800}.{avif,webp}
    problem → 16:10 (1600×1000 + 800×500)  → salon-workday-{1600,800}.{avif,webp}
    cta     → 16:9  (1600×900  + 800×450)  → workday-close-{1600,800}.{avif,webp}

Usage:
    python3 scripts/optimize-photography.py \
        --hero    path/to/hero-source.jpg \
        --problem path/to/problem-source.jpg \
        --cta     path/to/cta-source.jpg

Any role may be omitted; only the given roles are regenerated.
Add --dry-run to print the plan without writing files.

Guarantees
- Center-crop to the role's exact ratio; resize, never ship originals.
- AVIF + WebP for every variant (AVIF first in <picture>).
- Fails loudly if an output would exceed the size ceiling (~500 KB) or
  if a source is not a readable image — a multi-megabyte file can never
  silently end up in public/images.
- Deterministic filenames: the site markup does not change when the
  founder swaps photography. The image manifest (scripts/build-image-
  manifest.mjs) then hashes the files at build time so visitor caches
  invalidate correctly.

After replacing photos, ALSO update (documented in docs/IMAGERY.md):
- alt text + caption in src/pages/index.astro (HERO_PHOTO / PROBLEM_PHOTO
  / CTASection media props) — describe the NEW subject truthfully;
- the provenance rows in docs/IMAGERY.md and
  public/images/photography/PROVENANCE.md — source URL, license,
  photographer, crop, processing date.
- If a new source file is CC0-licensed like the current set (Mostafa
  Meraji, Wikimedia Commons), keep the same captions policy.

Requires: python3 + Pillow with AVIF support.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

OUT = Path("public/images/photography")
OUT.mkdir(parents=True, exist_ok=True)

# role -> (ratio w:h, target widths, output name prefix)
ROLES = {
    "hero": ((3, 2), (1600, 800), "barbershop-workday"),
    "problem": ((16, 10), (1600, 800), "salon-workday"),
    "cta": ((16, 9), (1600, 800), "workday-close"),
}

SIZE_CEILING_BYTES = 500 * 1024  # no 1600w variant may exceed this
AVIF_QUALITY = 44   # accepted photographic grade (docs/IMAGERY.md)
WEBP_QUALITY = 78


def crop_to_ratio(img: Image.Image, ratio_w: int, ratio_h: int) -> Image.Image:
    """Center-crop to an exact w:h ratio (no creative reframing)."""
    w, h = img.size
    target = ratio_w / ratio_h
    if w / h > target:  # too wide → crop the width
        new_w = round(h * target)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    new_h = round(w / target)  # too tall → crop the height
    top = (h - new_h) // 2
    return img.crop((0, top, w, top + new_h))


def process(role: str, source: Path, dry_run: bool) -> None:
    ratio_w, ratio_h = ROLES[role][0]
    widths = ROLES[role][1]
    prefix = ROLES[role][2]

    if not source.exists():
        sys.exit(f"[{role}] source not found: {source}")
    try:
        img = Image.open(source)
        img.load()
    except Exception as exc:  # noqa: BLE001 — report any unreadable input
        sys.exit(f"[{role}] cannot read image {source}: {exc}")

    if img.width < 1600 or img.height < round(1600 * ratio_h / ratio_w):
        sys.exit(
            f"[{role}] source too small for a 1600w variant "
            f"({img.width}×{img.height}); use a photo of at least 1600px on the long side"
        )

    print(f"[{role}] {source.name} ({img.width}×{img.height}) → {prefix}-*")
    cropped = crop_to_ratio(img.convert("RGB"), ratio_w, ratio_h)

    for width in widths:
        height = round(width * ratio_h / ratio_w)
        variant = cropped.resize((width, height), Image.LANCZOS)
        for ext, quality, method in (("avif", AVIF_QUALITY, 6), ("webp", WEBP_QUALITY, 6)):
            target = OUT / f"{prefix}-{width}.{ext}"
            if dry_run:
                print(f"    would write {target.name} ({width}×{height}, q{quality})")
                continue
            variant.save(target, ext.upper() if ext == "webp" else "AVIF", quality=quality, method=method)
            size = target.stat().st_size
            flag = "" if size <= SIZE_CEILING_BYTES else "  ⚠ OVER CEILING"
            print(f"    {target.name:32s} {size / 1024:7.1f} KB{flag}")
            if size > SIZE_CEILING_BYTES:
                sys.exit(f"[{role}] {target.name} exceeds {SIZE_CEILING_BYTES // 1024} KB — refusing to ship")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for role in ROLES:
        parser.add_argument(f"--{role}", type=Path, metavar="SOURCE", help=f"source photo for the {role} role ({ROLES[role][0][0]}:{ROLES[role][0][1]})")
    parser.add_argument("--dry-run", action="store_true", help="print the plan without writing")
    args = parser.parse_args()

    given = [role for role in ROLES if getattr(args, role) is not None]
    if not given:
        parser.print_help()
        sys.exit(1)

    for role in given:
        process(role, getattr(args, role), args.dry_run)

    print("\nDone. Next: rebuild (npm run build) so the image manifest picks up the")
    print("new hashes, then update alt/caption/provenance per docs/IMAGERY.md.")


if __name__ == "__main__":
    main()
