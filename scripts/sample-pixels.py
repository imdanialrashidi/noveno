#!/usr/bin/env python3
"""Sample rendered pixels from Playwright screenshots to verify appearance
deterministically (the primary model has no image vision; pixel sampling is
the reproducible substitute). Usage: python3 scripts/sample-pixels.py <png> <x> <y> [...]"""
import sys
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert("RGB")
w, h = img.size
print(f"image: {path} {w}x{h}")
for arg in sys.argv[2:]:
    x, y = (int(v) for v in arg.split(","))
    if x < 0 or y < 0 or x >= w or y >= h:
        print(f"  ({x},{y}) OUT OF BOUNDS")
        continue
    r, g, b = img.getpixel((x, y))
    print(f"  ({x},{y}) = #{r:02x}{g:02x}{b:02x}")
