#!/usr/bin/env python3
"""
Optimize work-preview captures → assets/images/work/{webp,avif} (logical sources).
Hashed copies are materialized into public/images/ by the manifest script.

Real screenshots captured from the actual delivered public sites
(1440×900 = 16:10) are the only source for real-project previews.
Output: WebP q80 + AVIF q62 (text-bearing screenshots need a higher
AVIF quality than photography) at native 1440×900 and half-size
720×450, plus the audit-page capture for the work detail page.

Requires: python3 + Pillow with webp+avif support.
Run:  python3 scripts/optimize-work-previews.py <png-or-webp> <output-name>

The half-size files keep the historical "-800" suffix (720px wide) for
srcset compatibility with src/data/work-previews.ts.
"""

import sys
from pathlib import Path

from PIL import Image

OUT = Path("assets/images/work")
OUT.mkdir(parents=True, exist_ok=True)

WEBP_QUALITY = 80
AVIF_QUALITY = 62  # screenshots carry UI text — do not undershoot


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, name = Path(sys.argv[1]), sys.argv[2]

    img = Image.open(src).convert("RGB")
    w, h = img.size
    assert (w, h) == (1440, 900), f"{src}: expected 1440x900, got {w}x{h}"

    results = []
    for width, height, suffix in ((1440, 900, ""), (720, 450, "-800")):
        variant = img if width == 1440 else img.resize((width, height), Image.LANCZOS)
        for ext, quality in (("webp", WEBP_QUALITY), ("avif", AVIF_QUALITY)):
            target = OUT / f"{name}{suffix}.{ext}"
            variant.save(target, ext.upper() if ext == "webp" else "AVIF", quality=quality, method=6)
            results.append((target.name, target.stat().st_size))

    for filename, size in results:
        print(f"  {filename:42s} {size / 1024:6.1f} KB")
    print(f"{name}: {w}x{h} → {len(results)} variants in {OUT}")


if __name__ == "__main__":
    main()
