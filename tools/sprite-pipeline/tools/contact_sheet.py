#!/usr/bin/env python3
"""Labelled contact sheet: one row per direction, one column per frame type.

  contact_sheet.py OUT --row "A Neon Strip" a1.png a2.png a3.png --row "B ..." ... [--cols est,play,key] [--w 640]
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--row", nargs="+", action="append", required=True)
ap.add_argument("--cols", default="")
ap.add_argument("--w", type=int, default=640)
a = ap.parse_args()

try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
except OSError:
    font = ImageFont.load_default()
cols = a.cols.split(",") if a.cols else []
first = Image.open(a.row[0][1])
h = round(first.height * a.w / first.width)
pad, label_w, head = 12, 190, 34 if cols else 0
W = label_w + len(a.row[0][1:]) * (a.w + pad) + pad
H = head + len(a.row) * (h + pad) + pad
sheet = Image.new("RGB", (W, H), (18, 10, 30))
d = ImageDraw.Draw(sheet)
for c, name in enumerate(cols):
    d.text((label_w + c * (a.w + pad) + pad, 6), name, fill=(255, 182, 73), font=font)
for r, (label, *files) in enumerate(a.row):
    y = head + r * (h + pad) + pad
    d.multiline_text((pad, y + 8), label.replace(" ", "\n", 1), fill=(240, 230, 210), font=font)
    for c, f in enumerate(files):
        sheet.paste(Image.open(f).convert("RGB").resize((a.w, h), Image.Resampling.LANCZOS),
                    (label_w + c * (a.w + pad) + pad, y))
sheet.save(a.out)
print(a.out, sheet.size)
