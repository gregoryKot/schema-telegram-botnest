"""Подборы и шипы на сетке x2: сердце (эталон ref/props.py), искра-память вместо монеты, шипы-мысли."""
import numpy as np
from PIL import Image, ImageDraw
from px import C, empty_at, outline_mask, strip

def heart():
    img = Image.new('L', (15, 14), 0); d = ImageDraw.Draw(img)
    d.ellipse((1, 1, 7, 7), fill=1); d.ellipse((7, 1, 13, 7), fill=1); d.polygon([(1, 5), (13, 5), (7, 12)], fill=1)
    a = np.array(img); out = np.zeros((14, 15, 4), np.uint8)
    out[a > 0] = C('#ff4d6d')
    out[(empty_at(a, 0, 1) | empty_at(a, 1, 0)) & (a > 0)] = C('#c42a52')
    out[outline_mask(a)] = C('#5a0f2c')
    for x, y, c in [(3, 3, '#ffc2cc'), (4, 3, '#ffc2cc'), (3, 4, '#ffc2cc'), (3, 2, '#ffffff'), (9, 3, '#ff8aa0')]:
        out[y, x] = C(c)
    return Image.fromarray(out, 'RGBA')

SP = 15
GLOW, WARM, PALE, WHITE, RIM = '#f08a3c', '#ffd27a', '#fff3c4', '#ffffff', '#8a3a2a'

def spark(f):
    """Искра ✦: ромб-сердцевина и четыре луча, длина дышит по кадрам; тёмно-тёплый контур держит её на светлом небе."""
    arm, core, diag = ((4, 2, 0), (5, 2, 0), (6, 3, 1), (5, 2, 0))[f]
    out = np.zeros((SP, SP, 4), np.uint8); a = np.zeros((SP, SP), np.uint8); c = SP // 2
    for y in range(SP):
        for x in range(SP):
            dx, dy = abs(x - c), abs(y - c); r = dx + dy
            ray = min(dx, dy) == 0 and r <= arm or r <= core or (dx == dy == core + diag and diag)
            if ray:
                a[y, x] = 1
                out[y, x] = C(WHITE if r <= 1 else PALE if r <= core else WARM if r < arm else GLOW)
    out[outline_mask(a)] = C(RIM)
    return Image.fromarray(out, 'RGBA')

TW, TH = 8, 12
THORN = dict(out='#2a1424', dark='#7a1f3c', base='#c8324e', lit='#ff7a5c', tip='#ffd39a')

def thorn(v):
    """Шип 8x12: кривой коготь из трещины, острие ловит солнце справа. Три варианта — ряд не строевой."""
    tip = (4, 3, 5)[v]; top = (0, 2, 1)[v]
    img = Image.new('L', (TW, TH), 0); d = ImageDraw.Draw(img)
    d.polygon([(1, TH - 1), (TW - 2, TH - 1), (tip + 1, top + 4), (tip, top)], fill=1)
    d.line([(tip, top), (tip, top + 3)], fill=1)
    a = np.array(img); out = np.zeros((TH, TW, 4), np.uint8)
    out[a > 0] = C(THORN['base'])
    out[empty_at(a, -1, 0)] = C(THORN['dark'])
    out[empty_at(a, 1, 0)] = C(THORN['lit'])
    out[top, tip] = C(THORN['tip']); out[top + 1, tip] = C(THORN['lit'])
    out[TH - 1][a[TH - 1] > 0] = C(THORN['dark'])
    out[outline_mask(a)] = C(THORN['out'])
    return Image.fromarray(out, 'RGBA')

def build():
    return {'spr_heart': heart(), 'spr_memory': strip([spark(f) for f in range(4)]),
            'spr_spikes': strip([thorn(v) for v in range(3)])}
