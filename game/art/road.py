"""Дорога гл.3 перед рассветом (показ x2): небо синего часа со светом у горизонта впереди и три
бесшовных слоя — холмы с городком позади, поля со столбами и тополями, обочина с оградой и остановкой.
Солнце ещё за горизонтом справа: кромки света — розовые, на правых гранях; листва уже отдаёт мятой."""
import math
import random
import numpy as np
from PIL import Image, ImageDraw
from px import C, PAL
from tile import GY, BAYER4, layer, wrap, rim_box, foliage, haze
import sky

P = PAL['ch3']
FAR_W, FAR_H, MID_W, MID_H, NEAR_W, NEAR_H = 480, 140, 640, 104, 800, 104
STAR, STAR_HALO = '#f0ecff', '#8c8cd0'

def glow(a, cx, cy):
    """Зарево за горизонтом: купол света дизером, без диска — солнце ещё не встало."""
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = (((xs - cx) / 1.9) ** 2 + (ys - cy) ** 2) ** .5
    for r, k, col in ((88, .2, 'sky8'), (66, .45, 'sky8'), (44, .75, 'sun_halo'), (30, 1.1, 'sun_halo'), (17, 1.1, 'sun')):
        a[(d <= r) & (BAYER4[ys % 4, xs % 4] < k)] = C(P[col])

def dawn_sky(size, ys, sun, clouds, stars, moon):
    a = sky.bands(*size, ys, P=P)
    glow(a, *sun)
    for x, y, parts in clouds:
        sky.cloud(a, sun[0], x, y, parts, P=P)
    img = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(img)
    for x, y, big in stars:
        if big:
            d.point([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)], fill=C(STAR_HALO))
        d.point((x, y), fill=C(STAR))
    mx, my = moon                                         # тонкий месяц тает в светлеющем небе
    d.ellipse((mx, my, mx + 10, my + 10), fill=C('#fff4dc'))
    d.ellipse((mx - 3, my - 2, mx + 6, my + 8), fill=C(P['sky0']))
    return img

LONG = [(30, -5, 50, 5), (0, 0, 140, 5), (70, 4, 96, 3), (10, 6, 34, 2)]
WISP = [(0, 0, 70, 3), (26, -2, 30, 3)]
DESK = dict(size=(480, 223), ys=(0, 38, 72, 102, 128, 150, 168, 184, 200), sun=(372, 214), moon=(74, 22), clouds=[
    (40, 96, LONG), (250, 122, LONG), (-40, 140, WISP), (150, 152, WISP), (392, 146, [(0, 0, 96, 4), (20, -3, 40, 3)]),
    (300, 76, WISP), (96, 170, [(0, 0, 50, 2)]), (238, 176, [(0, 0, 64, 2), (18, -2, 26, 2)]),
], stars=[(30, 12, 0), (120, 30, 1), (168, 8, 0), (214, 46, 0), (262, 18, 1), (318, 34, 0), (356, 10, 0),
          (408, 26, 1), (452, 52, 0), (20, 58, 0), (96, 70, 0), (184, 62, 0), (438, 8, 0), (290, 60, 0)])
# тач: над землёй 125 строк — синий верх короче, зарево и месяц в кадре
TOUCH = dict(size=(320, 133), ys=(0, 12, 26, 40, 54, 66, 78, 92, 106), sun=(244, 124), moon=(40, 30), clouds=[
    (130, 60, LONG), (-30, 52, WISP), (40, 82, WISP), (236, 78, [(0, 0, 70, 3), (16, -2, 30, 3)]), (150, 92, [(0, 0, 50, 2)]),
], stars=[(70, 22, 1), (118, 6, 0), (176, 18, 0), (226, 8, 1), (268, 26, 0), (300, 10, 0), (150, 34, 0)])

def ridge(d, w, base, amp, per, ph, fill, rim):
    """Гряда холмов: сумма двух синусоид с целым числом периодов — бесшовно; свет неба по гребню."""
    for x in range(2 * w):
        y = round(base - amp * math.sin(2 * math.pi * (x / w * per + ph)) - amp * .4 * math.sin(2 * math.pi * (x / w * (per + 1) * 2 + ph)))
        d.line((x, y, x, GY), fill=C(fill)); d.point((x, y), fill=C(rim))

def far():
    img, d = layer(FAR_W); rnd = random.Random(11)
    ridge(d, FAR_W, 170, 12, 2, .1, P['far'], P['far_rim'])
    for x, w, top in [(36, 12, 150), (50, 9, 156), (61, 15, 146), (78, 10, 154), (90, 13, 150), (106, 8, 158)]:
        rim_box(d, x, top, x + w, 176, P['far_dk'], P['far_rim'])       # городок остался позади
        for wy in range(top + 3, 170, 5):
            if rnd.random() < .5:
                d.point((x + 2 + rnd.randrange(w - 3), wy), fill=C(P['win']))
    d.line((70, 132, 70, 146), fill=C(P['far_dk'])); d.rectangle((67, 136, 73, 141), fill=C(P['far_dk']))   # водонапорка
    d.line((73, 136, 73, 141), fill=C(P['far_rim']))
    ridge(d, FAR_W, 188, 9, 3, .45, P['far_dk'], P['far'])
    return wrap(img, FAR_W, FAR_H)

def poplar(img, x, top):
    """Пирамидальный тополь: узкое веретено, зарево ловит правый край."""
    d = ImageDraw.Draw(img)
    d.line((x, GY - 14, x, GY), fill=C(P['mid_dk']))
    for y in range(top, GY - 8):
        t = (y - top) / (GY - 8 - top); r = round(1 + 4.2 * math.sin(math.pi * min(1, t * 1.15) ** .7))
        d.line((x - r, y, x + r, y), fill=C(P['mid_dk']))
        if y % 3 != 1: d.point((x + r, y), fill=C(P['mid_rim'] if t < .5 else P['mid_hi']))
        if y % 4 == 0 and r > 2: d.point((x + r - 2, y + 1), fill=C(P['mid_hi']))

def pole(d, x):
    d.rectangle((x, 132, x + 1, GY), fill=C(P['mid_dk'])); d.line((x + 2, 132, x + 2, GY), fill=C(P['mid_rim']))
    d.rectangle((x - 7, 136, x + 9, 137), fill=C(P['mid_dk'])); d.line((x - 7, 136, x + 9, 136), fill=C(P['mid_rim']))
    d.point([(x - 6, 135), (x + 8, 135)], fill=C(P['mid_hi']))

def wire(d, x0, x1, y, sag):
    for x in range(x0, x1 + 1):
        t = (x - x0) / (x1 - x0)
        d.point((x, round(y + sag * 4 * t * (1 - t))), fill=C(P['mid_dk']))

def house(d, x):
    rim_box(d, x, 186, x + 30, GY, P['mid'], P['mid_rim'])
    d.polygon([(x - 3, 186), (x + 15, 172), (x + 33, 186)], fill=C(P['mid_dk']))
    d.line((x + 15, 172, x + 33, 186), fill=C(P['mid_rim']))
    d.rectangle((x + 22, 172, x + 25, 180), fill=C(P['mid_dk'])); d.line((x + 25, 172, x + 25, 179), fill=C(P['mid_rim']))
    for sx, sy in ((24, 168), (26, 164), (25, 160), (28, 156)):          # дымок из трубы — печь топится
        d.point((x + sx, sy), fill=C(P['mid_hi']))
    d.rectangle((x + 5, 193, x + 10, 200), fill=C(P['win'])); d.point((x + 5, 193), fill=C(P['win_hi']))
    d.rectangle((x + 18, 193, x + 23, 200), fill=C(P['win_off']))
    d.line((x + 4, 201, x + 11, 201), fill=C(P['mid_hi']))

def mid():
    img, d = layer(MID_W)
    ridge(d, MID_W, 196, 6, 2, .3, P['mid'], P['mid_hi'])
    for i, x in enumerate(range(48, MID_W + 48, 148)):                   # столбы уходят вдоль дороги, провода провисают
        wire(d, x + 1, x + 149, 136, 9); wire(d, x - 6, x + 142, 135, 7)
        pole(d, x)
    d.rectangle((0, 132, 47, 146), fill=(0, 0, 0, 0))                    # левый вылет провода придёт склейкой
    for x, top in [(120, 150), (131, 142), (143, 154), (330, 146), (342, 156), (498, 148), (509, 140), (521, 152), (602, 158)]:
        poplar(img, x, top)
    house(d, 228)
    for x in (88, 400, 566):                                             # стога
        d.pieslice((x, 196, x + 22, 232), 180, 360, fill=C(P['mid_dk'])); d.arc((x, 196, x + 22, 232), 270, 360, fill=C(P['mid_rim']))
    return haze(wrap(img, MID_W, MID_H), MID_H - 34, P['haze'])

def tree(img, d, x, top):
    d.polygon([(x - 3, GY), (x - 2, top + 26), (x + 2, top + 26), (x + 3, GY)], fill=C(P['near']))
    d.line((x + 2, top + 26, x + 3, GY), fill=C(P['near_rim']))
    d.line((x, top + 34, x - 10, top + 22), fill=C(P['near']), width=2)
    d.line((x + 1, top + 30, x + 9, top + 20), fill=C(P['near']), width=2)
    blobs = [(x - 19, top + 16, 6), (x - 11, top + 20, 7), (x + 4, top + 21, 6), (x + 14, top + 17, 7),
             (x - 14, top + 6, 8), (x - 3, top + 10, 9), (x + 10, top + 6, 8), (x + 17, top + 1, 5),
             (x - 7, top - 4, 7), (x + 4, top - 7, 7), (x, top + 2, 6)]
    foliage(img, blobs, P['leaf'], P['leaf_lit'], P['near_dk'], P['ink'])

def bush(img, x, w, h):
    blobs = []
    for i, bx in enumerate(range(x + 4, x + w - 3, 5)):
        blobs += [(bx, GY - h + 4 + (i * 5 % 4), 4 + (i * 7 % 3)), (bx + 2, GY - 3, 5)]
    foliage(img, blobs, P['leaf'], P['leaf_lit'], P['near_dk'], P['ink'])

def rail(d, x0, x1):
    """Жердяная ограда: столбики и две жерди, свет по верху."""
    for y in (GY - 13, GY - 7):
        d.rectangle((x0, y, x1, y + 1), fill=C(P['near'])); d.line((x0, y, x1, y), fill=C(P['near_rim']))
    for x in range(x0 + 2, x1, 14):
        d.rectangle((x, GY - 17, x + 2, GY), fill=C(P['near'])); d.line((x + 2, GY - 17, x + 2, GY), fill=C(P['near_rim']))
        d.point((x + 1, GY - 18), fill=C(P['near_rim']))

def stop(d, x):
    """Остановка: навес на двух стойках, скамья, табличка — здесь ждут, а Мистер идёт."""
    d.rectangle((x - 2, GY - 44, x + 46, GY - 40), fill=C(P['near'])); d.line((x - 2, GY - 44, x + 46, GY - 44), fill=C(P['near_rim']))
    d.line((x - 2, GY - 39, x + 46, GY - 39), fill=C(P['near_dk']))
    for px in (x + 2, x + 40):
        d.rectangle((px, GY - 39, px + 1, GY), fill=C(P['near'])); d.line((px + 2, GY - 39, px + 2, GY), fill=C(P['near_rim']))
    d.rectangle((x + 4, GY - 36, x + 39, GY - 16), fill=C(P['near_dk']))
    d.rectangle((x + 6, GY - 34, x + 37, GY - 22), fill=C('#4c5890')); d.line((x + 6, GY - 34, x + 37, GY - 34), fill=C('#7a86bc'))
    d.rectangle((x + 8, GY - 10, x + 35, GY - 8), fill=C(P['near'])); d.line((x + 8, GY - 10, x + 35, GY - 10), fill=C(P['near_rim']))
    for lx in (x + 11, x + 31):
        d.line((lx, GY - 8, lx, GY), fill=C(P['near_dk']))
    d.rectangle((x + 50, GY - 52, x + 51, GY), fill=C(P['near'])); d.rectangle((x + 46, GY - 60, x + 55, GY - 52), fill=C('#e8b060'))
    d.rectangle((x + 48, GY - 58, x + 53, GY - 54), fill=C(P['near'])); d.line((x + 46, GY - 60, x + 55, GY - 60), fill=C('#fff0c0'))

def grass(d, rnd, w):
    """Трава обочины и первые цветы: мелкие штрихи вдоль всей ленты."""
    for x in range(0, w, 3):
        h = rnd.choice([1, 2, 2, 3, 4])
        d.line((x, GY - h, x, GY), fill=C(P['leaf'])); d.point((x, GY - h), fill=C(P['leaf_lit'] if rnd.random() < .5 else P['leaf']))
        if rnd.random() < .09:
            d.point((x + 1, GY - h - 1), fill=C(rnd.choice(['#ffd890', '#ff9ab0', '#fff4c8'])))

def near():
    img, d = layer(NEAR_W)
    rail(d, 150, 262); rail(d, 520, 640)
    tree(img, d, 96, 138); tree(img, d, 468, 134); tree(img, d, 706, 142)
    for x, w, h in [(18, 30, 12), (264, 26, 10), (430, 24, 11), (642, 32, 12), (752, 26, 10)]:
        bush(img, x, w, h)
    stop(d, 318)
    for x in (212, 590):                                                 # верстовые камни
        d.rectangle((x, GY - 9, x + 5, GY), fill=C(P['pave'])); d.line((x, GY - 9, x + 5, GY - 9), fill=C(P['curb_hi']))
        d.line((x + 5, GY - 8, x + 5, GY), fill=C(P['curb'])); d.line((x + 1, GY - 5, x + 4, GY - 5), fill=C(P['near']))
    grass(d, random.Random(5), NEAR_W)
    return wrap(img, NEAR_W, NEAR_H)

def signpost():
    """Указатель 40x64: мятная стрелка вперёд — тот же цвет, что у двери в конце дороги."""
    img = Image.new('RGBA', (40, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    ink = C(P['ink'])
    d.rectangle((9, 4, 13, 61), fill=ink); d.rectangle((10, 5, 11, 61), fill=C('#6a5a80')); d.point([(12, y) for y in range(5, 61)], fill=C(P['near_rim']))
    d.polygon([(2, 8), (29, 8), (37, 15), (37, 16), (29, 23), (2, 23)], fill=ink)
    d.polygon([(3, 9), (28, 9), (35, 15), (35, 16), (28, 22), (3, 22)], fill=C(PAL['dawn']['mint_dk']))
    d.line((3, 9, 28, 9), fill=C(PAL['dawn']['mint'])); d.line((28, 9, 35, 15), fill=C('#d8ffe8'))
    d.line((7, 15, 24, 15), fill=C('#eafff4')); d.line((7, 16, 24, 16), fill=C('#eafff4'))
    d.line((21, 12, 24, 15), fill=C('#eafff4')); d.line((21, 19, 24, 16), fill=C('#eafff4'))
    d.rectangle((7, 60, 15, 63), fill=ink); d.line((8, 61, 14, 61), fill=C(P['leaf_lit']))
    return img

def door():
    """Дверь терапевта 48x66: светлый камень, мятное полотно, тёплый свет в фрамуге и фонарик — скромная, но ждёт."""
    D = PAL['dawn']; img = Image.new('RGBA', (48, 66), (0, 0, 0, 0)); d = ImageDraw.Draw(img); ink = C(P['ink'])
    d.rectangle((3, 6, 44, 65), fill=ink); d.rectangle((4, 7, 43, 65), fill=C(D['stone']))
    d.line((4, 7, 43, 7), fill=C('#fff8e8')); d.line((43, 8, 43, 65), fill=C(D['stone_dk'])); d.line((4, 8, 4, 65), fill=C('#fff8e8'))
    d.rectangle((1, 3, 46, 6), fill=ink); d.rectangle((2, 4, 45, 5), fill=C(D['roof'])); d.line((2, 4, 45, 4), fill=C('#ffc0a0'))
    d.rectangle((9, 11, 38, 65), fill=ink)
    d.rectangle((10, 12, 37, 21), fill=C('#ffe2a0')); d.rectangle((10, 12, 37, 13), fill=C('#fff8e0'))     # фрамуга светится
    for x in (19, 28): d.line((x, 12, x, 21), fill=ink)
    d.rectangle((10, 23, 37, 65), fill=C(D['mint_dk'])); d.line((10, 23, 37, 23), fill=C(D['mint'])); d.line((10, 23, 10, 65), fill=C(D['mint']))
    for x0, y0, x1, y1 in ((13, 27, 22, 42), (25, 27, 34, 42), (13, 46, 22, 61), (25, 46, 34, 61)):       # филёнки
        d.rectangle((x0, y0, x1, y1), outline=C('#3e8a74')); d.line((x0 + 1, y1, x1, y1), fill=C(D['mint'])); d.line((x1, y0 + 1, x1, y1), fill=C(D['mint']))
    d.rectangle((33, 43, 35, 45), fill=C('#ffd27a')); d.point((33, 43), fill=C('#fff8e0'))                   # ручка
    d.rectangle((6, 63, 41, 65), fill=C(D['stone_dk'])); d.line((6, 63, 41, 63), fill=C('#fff8e8'))         # порог
    d.rectangle((21, 0, 26, 3), fill=ink); d.rectangle((22, 1, 25, 2), fill=C('#ffe2a0'))                   # фонарик над входом
    return img

def build():
    return {'bg_road_sky': dawn_sky(**DESK), 'bg_road_sky_touch': dawn_sky(**TOUCH),
            'bg_road_far': far(), 'bg_road_mid': mid(), 'bg_road_near': near(), 'prop_signpost': signpost(), 'door_therapist': door()}
