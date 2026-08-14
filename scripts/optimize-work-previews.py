#!/usr/bin/env python3
"""
Optimize work-preview captures → public/images/work/*.webp.

Real screenshots captured from the actual Noveno build (Playwright,
1440×900 = 16:10) are the only source for real-project previews.
Output: WebP (q80) at native 1440×900 + half-size 720×450, plus the
audit-page capture for the work detail page.

Requires: python3 + Pillow with webp support.
Run:  python3 scripts/optimize-work-previews.py <home-png> <audit-png>
"""

import sys
from pathlib import Path
from PIL import Image

OUT = Path("public/images/work")
OUT.mkdir(parents=True, exist_ok=True)

JOBS = [
    (sys.argv[1], "noveno-website-hero"),
    (sys.argv[2], "noveno-website-audit"),
]

for src, name in JOBS:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    assert (w, h) == (1440, 900), f"{src}: expected 1440x900, got {w}x{h}"
    # native size
    img.save(OUT / f"{name}.webp", "WEBP", quality=80, method=6)
    # half size for small viewports (720x450)
    half = img.resize((720, 450), Image.LANCZOS)
    half.save(OUT / f"{name}-800.webp", "WEBP", quality=80, method=6)
    print(f"{name}: {w}x{h} ->", 
          f"{OUT / name}.webp ({ (OUT / (name + '.webp')).stat().st_size // 1024 } KB),",
          f"{OUT / (name + '-800.webp')} ({ (OUT / (name + '-800.webp')).stat().st_size // 1024 } KB)")
