"""Улица гл.1 на закате: дальний и средний планы, бесшовные по горизонтали (показ x2).

far 480x140 — дымчатые силуэты: храм, телебашня, кран; светлее и холоднее всего;
mid 640x104 — розово-сливовые фасады против солнца, тёплые окна, дымка у земли.
Ближний план — near.py. Координаты — эталонные (tile.GY), сдвиг +16: слой в игре
начинается на 32 px левее кадра. Солнце справа: кромка света — на правых гранях.
"""
import random
from PIL import ImageDraw
from px import C, PAL
from tile import GY, layer, wrap, rim_box, foliage, haze
import near

P = PAL['ch1']
FAR_W, FAR_H, MID_W, MID_H = 480, 140, 640, 104

def far():
    img, d = layer(FAR_W); rnd = random.Random(7)
    x = 0
    while x < FAR_W:
        w = min(rnd.randint(14, 34), FAR_W - 1 - x); top = rnd.randint(144, 172)
        rim_box(d, x, top, x + w, GY, P['far'], P['far_rim'])
        if w > 12 and rnd.random() < .35:                 # надстройка на крыше
            rim_box(d, x + 3, top - 5, x + 8, top - 1, P['far'], P['far_rim'])
        if rnd.random() < .5:                             # редкие далёкие окна
            for wy in range(top + 5, GY - 20, 6):
                for wx in range(x + 3, x + w - 2, 5):
                    if rnd.random() < .12:
                        d.point((wx, wy), fill=C(P['far_rim']))
        x += w + rnd.choice([0, 0, 2, 5])
    # храм с луковкой, телебашня, кран — узнаваемый силуэт города
    rim_box(d, 68, 150, 90, GY, P['far'], P['far_rim'])
    rim_box(d, 74, 136, 84, 150, P['far'], P['far_rim'])
    d.ellipse((72, 124, 86, 140), fill=C(P['far'])); d.arc((72, 124, 86, 140), 270, 60, fill=C(P['far_rim']))
    d.line((79, 116, 79, 124), fill=C(P['far'])); d.line((77, 119, 81, 119), fill=C(P['far']))
    tx = 448
    d.polygon([(tx - 5, GY), (tx - 1, 104), (tx + 1, 104), (tx + 5, GY)], fill=C(P['far']))
    d.line((tx + 1, 104, tx + 5, GY), fill=C(P['far_rim']))
    d.rectangle((tx - 4, 116, tx + 4, 121), fill=C(P['far'])); d.line((tx - 4, 116, tx + 4, 116), fill=C(P['far_rim']))
    d.line((tx, 80, tx, 104), fill=C(P['far']))
    d.line((166, 128, 166, GY), fill=C(P['far_dk']), width=2)
    d.line((150, 128, 202, 128), fill=C(P['far_dk'])); d.line((166, 124, 202, 128), fill=C(P['far_dk']))
    d.line((196, 128, 196, 138), fill=C(P['far_dk']))
    return wrap(img, FAR_W, FAR_H)

def windows(d, rnd, x0, y0, x1, y1, lit):
    for wy in range(y0, y1 - 4, 8):
        for wx in range(x0, x1 - 3, 6):
            on = rnd.random() < lit
            d.rectangle((wx, wy, wx + 2, wy + 3), fill=C(P['win'] if on else P['win_off']))
            if on:
                d.point((wx, wy), fill=C(P['win_hi']))
                if rnd.random() < .5:
                    d.line((wx, wy + 3, wx + 2, wy + 3), fill=C('#e8a466'))
            d.line((wx, wy + 4, wx + 2, wy + 4), fill=C(P['mid_hi']))      # подоконник

def building(d, rnd, x, w, top, roof):
    rim_box(d, x, top, x + w, GY, P['mid'], P['mid_rim'])
    if roof == 'gable':
        d.polygon([(x - 2, top), (x + w // 2, top - w // 3), (x + w + 2, top)], fill=C(P['mid_dk']))
        d.line((x + w // 2, top - w // 3, x + w + 2, top), fill=C(P['mid_rim']))
        d.line((x - 2, top, x + w + 2, top), fill=C(P['mid_dk']))
        d.rectangle((x + w - 8, top - w // 3 - 2, x + w - 5, top - 6), fill=C(P['mid_dk']))   # труба
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
    for fy in range(top + 14, GY, 14):                    # карнизы этажей
        d.line((x + 1, fy, x + w - 1, fy), fill=C(P['mid_dk']))
    windows(d, rnd, x + 4, top + 5, x + w - 2, GY - 6, rnd.uniform(.18, .32))

def tree_round(img, cx, cy, r):
    ImageDraw.Draw(img).rectangle((cx - 1, cy, cx + 1, GY), fill=C(P['mid_dk']))
    blobs = [(cx - r // 2, cy + 2, int(r * .7)), (cx + r // 2, cy + 3, int(r * .7)),
             (cx, cy - r // 3, int(r * .8)), (cx + r // 3, cy - r // 2, int(r * .5))]
    foliage(img, blobs, P['mid_dk'], P['mid_hi'], '#7a3e62')

MID_PLAN = [(10, 50, 150, 'tank'), (68, 38, 166, 'gable'), (116, 56, 142, 'antenna'), (242, 44, 160, 'gable'),
            (286, 30, 176, 'flat'), (408, 46, 150, 'gable'), (462, 50, 138, 'tank'), (546, 34, 168, 'flat'),
            (580, 50, 146, 'gable')]
MID_TREES = [(192, 190, 12), (216, 184, 15), (332, 192, 11), (388, 188, 13), (528, 191, 11)]

def mid():
    img, d = layer(MID_W); rnd = random.Random(3)
    for x, w, top, roof in MID_PLAN:
        building(d, rnd, x, w, top, roof)
    for tx, ty, r in MID_TREES:
        tree_round(img, tx, ty, r)
    return haze(wrap(img, MID_W, MID_H), MID_H - 37, P['haze'])

def build():
    return {'bg_street_far': far(), 'bg_street_mid': mid(), 'bg_street_near': near.near()}
