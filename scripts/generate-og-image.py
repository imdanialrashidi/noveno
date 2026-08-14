#!/usr/bin/env python3
"""
Generate public/og.png — the social-share poster (1200×630).

Reproducible generator using the accepted brand tokens (docs/DESIGN.md §6):
canvas #f9fafa, ink #070808, muted #4c5751, faint #66716b, line-strong
#7e8a83, primary #679e86. Composition follows the 2026-08-14 route-band
signature: the NOVENO wordmark + the promise line + a full-width route
with large square stations (اقدام as the filled CTA station, then
ثبت ← پیگیری ← نتیجه) — no fabricated metrics, labels below the line.

Requires: python3 + Pillow with raqm (Arabic shaping).
Run:  python3 scripts/generate-og-image.py
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CANVAS = "#f9fafa"
INK = "#070808"
MUTED = "#4c5751"
FAINT = "#66716b"
LINE = "#7e8a83"
PRIMARY = "#679e86"
ON_PRIMARY = "#06130d"

FONT_DIR = "/usr/share/fonts/noto"

def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}", size)

F_WORD = font("NotoSansArabic-SemiCondensedExtraBold.ttf", 92)
F_TAG = font("NotoSansArabic-SemiCondensedMedium.ttf", 30)
F_LABEL = font("NotoSansArabic-SemiCondensedMedium.ttf", 26)
F_FOOT = font("NotoSansArabicUI-SemiCondensedMedium.ttf", 28)

STATIONS = ["اقدام", "ثبت", "پیگیری", "نتیجه"]

def draw_rtl_text(draw, xy, text, fnt, fill, anchor="ra"):
    """anchor 'ra' = right-ascender; RTL shaping via raqm."""
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor, direction="rtl", language="fa")

def main():
    img = Image.new("RGB", (W, H), CANVAS)
    d = ImageDraw.Draw(img)

    # --- wordmark + promise (right-aligned, RTL) ---
    draw_rtl_text(d, (W - 80, 96), "نوونو", F_WORD, INK)
    draw_rtl_text(d, (W - 84, 232), "سیستم جذب مشتری برای کسب‌وکارهای خدماتی", F_TAG, MUTED)
    draw_rtl_text(d, (W - 84, 288), "NOVENO", F_TAG, FAINT)

    # --- section node marker (the one chrome-level route reference) ---
    d.rounded_rectangle([W - 84, 74, W - 78, 80], radius=1, fill=PRIMARY)

    # --- the route band (RTL: right → left), labels BELOW the line ---
    y = 452
    x_right, x_left = W - 84, 84
    n = len(STATIONS)
    spacing = (x_right - x_left) / (n - 1)
    line_y = y
    d.line([(x_left, line_y), (x_right, line_y)], fill=LINE, width=3)

    for i, label in enumerate(STATIONS):
        x = round(x_right - i * spacing)
        is_last = i == n - 1
        size = 20
        if i == 0:
            # the CTA station: filled primary square (اقدام شما)
            d.rounded_rectangle(
                [x - size, line_y - size, x + size, line_y + size],
                radius=1,
                fill=PRIMARY,
            )
        elif is_last:
            d.rounded_rectangle(
                [x - size / 2, line_y - size / 2, x + size / 2, line_y + size / 2],
                radius=1,
                fill=PRIMARY,
            )
        else:
            d.rounded_rectangle(
                [x - size / 2, line_y - size / 2, x + size / 2, line_y + size / 2],
                radius=1,
                outline=LINE,
                width=3,
            )
        # labels below the line (adjacent, never inside nodes)
        draw_rtl_text(d, (x, line_y + 42), label, F_LABEL, MUTED if not (i == 0 or is_last) else INK)

    # --- footer domain ---
    draw_rtl_text(d, (W - 84, H - 74), "noveno.ir", F_FOOT, FAINT)

    out = "public/og.png"
    img.save(out, "PNG")
    print(f"wrote {out} ({W}x{H})")


if __name__ == "__main__":
    main()
