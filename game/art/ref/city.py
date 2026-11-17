"""Город главы 1 в три плана: дальний (дымка), средний (окна), ближний (деревья, ограда).
Атмосферная перспектива: дальше — светлее и холоднее, ближе — темнее и теплее.
Солнце в кадре: кромка света — на гранях, обращённых к солнцу."""
import random
import numpy as np
from PIL import Image, ImageDraw
from pix import C, BAYER4, foliage
from pal import CH1 as P
from sky import SUN, W, H

GY = 215

def rim_box(d, x0, y0, x1, y1, base, rim, top=True):
    d.rectangle((x0, y0, x1, y1), fill=C(base))
    if top: d.line((x0, y0, x1, y0), fill=C(rim))
    side = x1 if (x0 + x1) / 2 < SUN[0] else x0
    d.line((side, y0, side, y1), fill=C(rim))

def far():
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img); rnd = random.Random(7)
    x = -4
    while x < W:
        w = rnd.randint(14, 34); top = rnd.randint(132, 164)
        if SUN[0] - 34 < x + w and x < SUN[0] + 30: top = max(top, 170)
        rim_box(d, x, top, x + w, GY, P['far'], P['far_rim'])
        if rnd.random() < .35:  # бак/надстройка на крыше
            rim_box(d, x + 3, top - 5, x + 8, top - 1, P['far'], P['far_rim'])
        if rnd.random() < .5:
            for wy in range(top + 5, GY - 20, 6):
                for wx in range(x + 3, x + w - 2, 5):
                    if rnd.random() < .12: d.point((wx, wy), fill=C(P['far_rim']))
        x += w + rnd.choice([0, 0, 2, 5])
    # храм с луковкой слева и телебашня справа — узнаваемый силуэт города
    rim_box(d, 52, 150, 74, GY, P['far'], P['far_rim'])
    rim_box(d, 58, 136, 68, 150, P['far'], P['far_rim'])
    d.ellipse((56, 124, 70, 140), fill=C(P['far'])); d.arc((56, 124, 70, 140), 200, 340, fill=C(P['far_rim']))
    d.line((63, 116, 63, 124), fill=C(P['far'])); d.line((61, 119, 65, 119), fill=C(P['far']))
    tx = 432
    d.polygon([(tx - 5, GY), (tx - 1, 104), (tx + 1, 104), (tx + 5, GY)], fill=C(P['far']))
    d.line((tx - 1, 104, tx - 5, GY), fill=C(P['far_rim']))
    d.rectangle((tx - 4, 116, tx + 4, 121), fill=C(P['far'])); d.line((tx - 4, 116, tx + 4, 116), fill=C(P['far_rim']))
    d.line((tx, 80, tx, 104), fill=C(P['far']))
    # кран — город строится
    d.line((150, 128, 150, GY), fill=C(P['far_dk']), width=2)
    d.line((134, 128, 186, 128), fill=C(P['far_dk'])); d.line((150, 124, 186, 128), fill=C(P['far_dk']))
    d.line((180, 128, 180, 138), fill=C(P['far_dk']))
    return img

def windows(d, rnd, x0, y0, x1, y1, lit=.4, ww=3, wh=4, gx=3, gy=4):
    for wy in range(y0, y1 - wh, wh + gy):
        for wx in range(x0, x1 - ww, ww + gx):
            on = rnd.random() < lit
            d.rectangle((wx, wy, wx + ww - 1, wy + wh - 1), fill=C(P['win'] if on else P['win_off']))
            if on:
                d.point((wx, wy), fill=C(P['win_hi']))
                if rnd.random() < .5: d.line((wx, wy + wh - 1, wx + ww - 1, wy + wh - 1), fill=C('#e8a466'))
            d.line((wx, wy + wh, wx + ww - 1, wy + wh), fill=C(P['mid_hi']))  # подоконник

def building(d, rnd, x, w, top, roof):
    rim_box(d, x, top, x + w, GY, P['mid'], P['mid_rim'])
    if roof == 'gable':
        d.polygon([(x - 2, top), (x + w // 2, top - w // 3), (x + w + 2, top)], fill=C(P['mid_dk']))
        d.line((x + w // 2, top - w // 3, x + w + 2, top), fill=C(P['mid_rim']))
        d.line((x - 2, top, x + w + 2, top), fill=C(P['mid_dk']))
        d.rectangle((x + w - 8, top - w // 3 - 2, x + w - 5, top - 6), fill=C(P['mid_dk']))
        d.line((x + w - 5, top - w // 3 - 2, x + w - 5, top - 6), fill=C(P['mid_rim']))
    elif roof == 'tank':
        d.line((x - 1, top, x + w + 1, top), fill=C(P['mid_rim']))
        tx = x + w // 3
        rim_box(d, tx, top - 10, tx + 8, top - 4, P['mid_dk'], P['mid_rim'])
        d.polygon([(tx - 1, top - 10), (tx + 4, top - 14), (tx + 9, top - 10)], fill=C(P['mid_dk']))
        d.line((tx + 1, top - 4, tx + 1, top), fill=C(P['mid_dk'])); d.line((tx + 7, top - 4, tx + 7, top), fill=C(P['mid_dk']))
    elif roof == 'antenna':
        d.line((x + w - 6, top - 12, x + w - 6, top), fill=C(P['mid_dk']))
        d.line((x + w - 10, top - 9, x + w - 2, top - 9), fill=C(P['mid_dk']))
    for fy in range(top + 14, GY, 14):  # карнизы этажей
        d.line((x + 1, fy, x + w - 1, fy), fill=C(P['mid_dk']))
    windows(d, rnd, x + 4, top + 5, x + w - 2, GY - 6, lit=rnd.uniform(.18, .32))

def mid():
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img); rnd = random.Random(3)
    plan = [(-6, 50, 150, 'tank'), (52, 38, 166, 'gable'), (100, 56, 142, 'antenna'),
            (226, 44, 160, 'gable'), (270, 30, 176, 'flat'), (392, 46, 150, 'gable'), (446, 50, 138, 'tank')]
    for x, w, top, roof in plan:
        building(d, rnd, x, w, top, roof)
    for tx, ty, r in [(176, 190, 12), (200, 184, 15), (316, 192, 11), (372, 188, 13)]:
        tree_round(img, tx, ty, r)
    haze(img, 178, GY, P['haze'])
    return img

def haze(img, y0, y1, col, steps=(.22, .45, .68)):
    """Дымка у земли: ступени смешения к тёплому цвету, дизер только на стыках ступеней."""
    a = np.array(img).astype(float); c = np.array(C(col), float)
    n = len(steps); band = (y1 - y0) / n
    for y in range(y0, min(y1 + 1, H)):
        k = min(n - 1, int((y - y0) / band)); f = (y - y0 - k * band) / band
        for x in range(W):
            if not a[y, x, 3]: continue
            kk = k + 1 if (k + 1 < n and f > .7 and (f - .7) / .3 > BAYER4[y % 4, x % 4]) else k
            a[y, x, :3] = a[y, x, :3] * (1 - steps[kk]) + c[:3] * steps[kk]
    img.paste(Image.fromarray(a.astype(np.uint8), 'RGBA'))

def tree_round(img, cx, cy, r):
    d = ImageDraw.Draw(img)
    d.rectangle((cx - 1, cy, cx + 1, GY), fill=C(P['mid_dk']))
    blobs = [(cx - r // 2, cy + 2, int(r * .7)), (cx + r // 2, cy + 3, int(r * .7)), (cx, cy - r // 3, int(r * .8)),
             (cx + r // 3, cy - r // 2, int(r * .5))]
    foliage(img, blobs, P['mid_dk'], P['mid_hi'], '#7a3e62')
