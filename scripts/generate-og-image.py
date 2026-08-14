#!/usr/bin/env python3
"""
Generate public/og.png — the social-share poster (1200×630).

Reproducible generator using the accepted brand tokens (docs/DESIGN.md):
canvas #f9fafa, ink #070808, muted #4c5751, faint #66716b, primary
#679e86, on-primary #06130d. Composition follows the 2026-08-14
image-led editorial redesign: the NOVENO wordmark + the promise line
on the right, and a real working-environment photograph (CC0, Mostafa
Meraji — the same art direction as the homepage hero) on the left.
No fabricated metrics, no diagrams.

Requires: python3 + Pillow with raqm (Arabic shaping).
Run:  python3 scripts/generate-og-image.py
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CANVAS = "#f9fafa"
INK = "#070808"
MUTED = "#4c5751"
FAINT = "#66716b"
PRIMARY = "#679e86"
ON_PRIMARY = "#06130d"

FONT_DIR = "/usr/share/fonts/noto"
PHOTO = "public/images/photography/barbershop-workday-1600.webp"
OUT = "public/og.png"

def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}", size)

F_WORD = font("NotoSansArabic-SemiCondensedExtraBold.ttf", 88)
F_TAG = font("NotoSansArabic-SemiCondensedMedium.ttf", 28)
F_LABEL = font("NotoSansArabic-SemiCondensedBold.ttf", 30)
F_CTA = font("NotoSansArabic-SemiCondensedBold.ttf", 30)

HEADLINE = [
    "بازدید را به یک مسیر قابل‌پیگیری",
    "برای جذب مشتری تبدیل کنید.",
]
TAGLINE = "سیستم جذب مشتری برای کسب‌وکارهای خدماتی"
CTA = "درخواست بررسی مسیر جذب"
URL = "noveno.ir"

def draw_rtl_text(draw, xy, text, fnt, fill, anchor="ra"):
    """anchor 'ra' = right-ascender; RTL shaping via raqm."""
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor,
              features=["rtla"], direction="rtl")

def main():
    img = Image.new("RGB", (W, H), CANVAS)
    draw = ImageDraw.Draw(img)

    # --- photograph panel (left ~45%) — real working environment ---
    photo = Image.open(PHOTO).convert("RGB")
    panel_w = int(W * 0.44)
    # cover-crop the photo into the panel
    ratio = panel_w / H
    pw, ph = photo.size
    if pw / ph > ratio:
        nw = int(ph * ratio)
        left = (pw - nw) // 2
        photo = photo.crop((left, 0, left + nw, ph))
    else:
        nh = int(pw / ratio)
        top = (ph - nh) // 2
        photo = photo.crop((0, top, pw, top + nh))
    photo = photo.resize((panel_w, H), Image.LANCZOS)
    # hairline between photo and text
    img.paste(photo, (0, 0))
    draw.rectangle([panel_w, 0, panel_w + 2, H], fill="#dfe3e1")

    # --- typography (right side) ---
    text_x = W - 64
    draw_rtl_text(draw, (text_x, 56), "NOVENO", F_WORD, INK, anchor="ra")

    draw_rtl_text(draw, (text_x, 186), TAGLINE, F_TAG, MUTED, anchor="ra")

    # headline — two wrapped lines, measured to fit the text column
    for i, line in enumerate(HEADLINE):
        draw_rtl_text(draw, (text_x, 268 + i * 52), line, F_LABEL, INK, anchor="ra")

    # primary CTA pill (right-aligned, like the hero button)
    cta_w = 340
    cta_h = 64
    x0 = text_x - cta_w
    y0 = 430
    draw.rounded_rectangle([x0, y0, text_x, y0 + cta_h], radius=6, fill=PRIMARY)
    draw_rtl_text(draw, ((x0 + text_x) // 2, y0 + cta_h // 2), CTA, F_CTA,
                  ON_PRIMARY, anchor="mm")

    draw_rtl_text(draw, (text_x, 540), f"عکس: Mostafa Meraji (CC0)  ·  {URL}", F_TAG,
                  FAINT, anchor="ra")

    img.save(OUT, "PNG")
    import os
    print(f"{OUT}: {os.path.getsize(OUT) // 1024} KB")

if __name__ == "__main__":
    main()
