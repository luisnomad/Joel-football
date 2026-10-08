"""Compose the proposed roster line-up from chosen green-screen refs.

usage: lineup.py OUT.png id=path ...
Keys chroma green, crops to the subject, scales each to its class idle height
(adult 380 / kid 330 cell px), stands everyone on one ground line and draws height
guides. A second strip shows the same line-up at in-game size (x0.583) next to the
current sprites so the change in presence is visible.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) + '/'
KIDS = {'joel', 'luna', 'bob'}
H = {'adult': 380, 'kid': 330}
OLD = {'joel': 'v1', 'bob': 'v2', 'lucia': 'v2', 'luna': 'v2', 'juan': 'v3', 'dad': 'v1', 'mum': 'v1', 'juanjo': 'v1'}
OLD_VS = {'dad': 1.2, 'mum': 1.2}
DISPLAY = 280 / 480


def key(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = (g > r + 40) & (g > b + 40)
    alpha = np.where(green, 0, 255).astype(np.uint8)
    rgb = a.copy()
    # despill: clamp green to max(r, b) on edge pixels
    spill = (g > np.maximum(r, b)) & ~green
    rgb[..., 1] = np.where(spill, np.maximum(r, b), g)
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')
    return im.crop(im.getbbox())


def font(size):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


out = sys.argv[1]
items = [a.split('=', 1) for a in sys.argv[2:]]
COL, GROUND, TOP = 300, 520, 70
W = COL * len(items)
img = Image.new('RGB', (W, 1000), (34, 38, 46))
d = ImageDraw.Draw(img)
for cls, h in H.items():
    y = GROUND - h
    d.line((0, y, W, y), fill=(90, 150, 220) if cls == 'adult' else (230, 160, 80), width=2)
    d.text((6, y - 22), f'{cls} {h}px', fill=(200, 200, 200), font=font(18))
d.line((0, GROUND, W, GROUND), fill=(220, 220, 220), width=2)
f = font(24)
GROUND2 = 960
d.text((6, 600), 'in-game size (x0.583): new (left) vs current (right, incl. Dad/Mum x1.2)', fill=(200, 200, 200), font=font(18))
d.line((0, GROUND2, W, GROUND2), fill=(220, 220, 220), width=2)
for i, (cid, path) in enumerate(items):
    cls = 'kid' if cid in KIDS else 'adult'
    sub = key(ROOT + path if not path.startswith('/') else path)
    s = H[cls] / sub.height
    sub = sub.resize((round(sub.width * s), H[cls]), Image.LANCZOS)
    x = i * COL + (COL - sub.width) // 2
    img.paste(sub, (x, GROUND - sub.height), sub)
    d.text((i * COL + 12, 20), f'{cid}  ({cls})', fill=(255, 255, 255), font=f)
    d.text((i * COL + 12, GROUND + 10), f'{sub.width}w x {sub.height}h', fill=(170, 170, 170), font=font(16))
    # in-game strip
    small = sub.resize((round(sub.width * DISPLAY), round(sub.height * DISPLAY)), Image.LANCZOS)
    img.paste(small, (i * COL + COL // 2 - small.width - 4, GROUND2 - small.height), small)
    old = Image.open(f'{ROOT}public/assets/player-{cid}-sheet-{OLD[cid]}.webp').convert('RGBA').crop((0, 0, 320, 480))
    old = old.crop(old.getbbox())
    os_ = DISPLAY * OLD_VS.get(cid, 1)
    old = old.resize((round(old.width * os_), round(old.height * os_)), Image.LANCZOS)
    img.paste(old, (i * COL + COL // 2 + 4, GROUND2 - old.height), old)
img.save(out)
print('saved', out, img.size)
