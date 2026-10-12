"""Roster-v2 line-up review: idle of every character at in-game scale on one ground
line, plus one 24-cell strip per character.

  roster_lineup.py OUT.png id=atlas.webp ...
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

CELL_W, CELL_H, COLS, GROUND = 336, 480, 6, 418
DISPLAY = 280 / 480          # in-game scale (480 px cell -> 280 world px)
STRIP_SCALE = 0.25


def font(size):
    for path in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def cell(atlas, index):
    x, y = (index % COLS) * CELL_W, (index // COLS) * CELL_H
    return atlas.crop((x, y, x + CELL_W, y + CELL_H))


out = sys.argv[1]
items = [arg.split('=', 1) for arg in sys.argv[2:]]
atlases = {name: Image.open(path).convert('RGBA') for name, path in items}

# Line-up: idle cell 0, scaled to in-game size, feet on one ground line.
col = 150
lineup_h = 300
lineup = Image.new('RGB', (col * len(items), lineup_h), (34, 38, 52))
draw = ImageDraw.Draw(lineup)
ground_y = lineup_h - 40
draw.line((0, ground_y, lineup.width, ground_y), fill=(200, 200, 200), width=2)
for i, (name, _) in enumerate(items):
    idle = cell(atlases[name], 0)
    ys = np.nonzero(np.array(idle)[:, :, 3].any(1))[0]
    small = idle.resize((round(CELL_W * DISPLAY), round(CELL_H * DISPLAY)), Image.LANCZOS)
    x = i * col + (col - small.width) // 2
    lineup.paste(small, (x, ground_y - round(GROUND * DISPLAY)), small)
    draw.text((i * col + 8, 8), name, fill='white', font=font(18))
    draw.text((i * col + 8, ground_y + 8), f'idle {GROUND - ys[0]}px', fill=(170, 170, 170), font=font(13))

# Strips: all 24 cells per character.
sw, sh = round(CELL_W * STRIP_SCALE), round(CELL_H * STRIP_SCALE)
strips = Image.new('RGB', (sw * 24 + 90, sh * len(items)), (34, 38, 52))
sdraw = ImageDraw.Draw(strips)
for r, (name, _) in enumerate(items):
    sdraw.text((6, r * sh + sh // 2 - 8), name, fill='white', font=font(14))
    for i in range(24):
        c = cell(atlases[name], i).resize((sw, sh), Image.LANCZOS)
        strips.paste(c, (90 + i * sw, r * sh), c)

sheet = Image.new('RGB', (max(lineup.width, strips.width), lineup.height + strips.height), (34, 38, 52))
sheet.paste(lineup, (0, 0))
sheet.paste(strips, (0, lineup.height))
sheet.save(out)
print('saved', out, sheet.size)
