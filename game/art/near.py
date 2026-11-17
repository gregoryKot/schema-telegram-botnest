"""Ближний план гл.1, 800x104, бесшовный: кафе с маркизой и тёплой витриной, деревья,
ограда, кусты, скамейка, афишная тумба. Темнее и теплее среднего плана; кромка — от солнца справа."""
from px import C, PAL
from tile import GY, layer, wrap, foliage

P = PAL['ch1']
W, H = 800, 104
AWN = ('#f0b48c', '#c4505a')

def cafe(d, x0):
    x1, top = x0 + 68, 118
    d.rectangle((x0, top, x1, GY), fill=C(P['near']))
    d.line((x1, top, x1, GY), fill=C(P['near_rim'])); d.line((x0, top, x1, top), fill=C(P['near_rim']))
    d.rectangle((x0 - 1, top - 4, x1 + 2, top - 1), fill=C(P['near_dk']))                # карниз
    d.line((x0 - 1, top - 4, x1 + 2, top - 4), fill=C(P['near_rim']))
    for wx in (x0 + 10, x0 + 36):                         # окна второго этажа, одно светится
        d.rectangle((wx, top + 8, wx + 12, top + 24), fill=C(P['near_dk']))
        if wx == x0 + 10:
            d.rectangle((wx + 1, top + 9, wx + 11, top + 23), fill=C(P['win']))
            d.rectangle((wx + 1, top + 9, wx + 4, top + 23), fill=C('#e89a5e'))          # штора
            d.point((wx + 10, top + 10), fill=C(P['win_hi']))
        d.line((wx - 1, top + 25, wx + 13, top + 25), fill=C(P['near_rim']))
    ay = 156                                              # маркиза в полоску с фестонами
    for i, x in enumerate(range(x0, x1 + 4, 6)):
        d.polygon([(x, ay), (x + 6, ay), (x + 8, ay + 9), (x + 2, ay + 9)], fill=C(AWN[i % 2]))
    d.line((x0, ay - 1, x1 + 4, ay - 1), fill=C(P['near_dk']))
    for x in range(x0 + 3, x1 + 8, 4):
        d.point((x, ay + 10), fill=C(AWN[1]))
    # витрина: тёплый интерьер, силуэты столиков и чашек, лампа-шар
    d.rectangle((x0 + 6, 170, x0 + 60, 206), fill=C(P['near_dk']))
    d.rectangle((x0 + 8, 172, x0 + 58, 204), fill=C(P['win']))
    d.rectangle((x0 + 8, 172, x0 + 58, 175), fill=C(P['win_hi']))
    d.line((x0 + 33, 172, x0 + 33, 204), fill=C(P['near_dk']))
    for tx in (x0 + 16, x0 + 44):
        d.rectangle((tx - 5, 194, tx + 5, 195), fill=C('#a8584a')); d.line((tx, 196, tx, 204), fill=C('#a8584a'))
        d.rectangle((tx - 2, 191, tx, 193), fill=C('#c86a50'))
    d.ellipse((x0 + 20, 178, x0 + 26, 184), fill=C('#ffe7a8'))
    d.rectangle((x0 + 4, 206, x0 + 64, GY), fill=C(P['near_dk']))
    d.line((x0 + 4, 206, x0 + 64, 206), fill=C(P['near_rim']))
    pot(d, x0 + 73)

def pot(d, x):
    """Терракотовый горшок с геранью: тёплый и светлее кота — с ним не путается."""
    d.polygon([(x, 203), (x + 12, 203), (x + 10, GY), (x + 2, GY)], fill=C(P['pave']))
    d.rectangle((x - 1, 201, x + 13, 203), fill=C(P['curb'])); d.line((x - 1, 201, x + 13, 201), fill=C(P['curb_hi']))
    d.line((x + 12, 204, x + 10, GY), fill=C(P['curb'])); d.line((x + 1, 207, x + 11, 207), fill=C(P['pave_sh']))
    for dx, dy, c in [(2, 199, '#7ea04a'), (4, 197, '#7ea04a'), (6, 198, '#5e8040'), (8, 196, '#7ea04a'),
                      (10, 198, '#7ea04a'), (3, 196, '#ff8aa0'), (7, 194, '#ff6a84'), (11, 196, '#ff8aa0'),
                      (5, 199, '#5e8040'), (9, 199, '#5e8040'), (7, 195, '#ffd36a')]:
        d.point((x + dx, dy), fill=C(c))

def tree(img, d, x, top):
    d.polygon([(x - 3, GY), (x - 2, top + 26), (x + 2, top + 26), (x + 3, GY)], fill=C(P['near']))
    d.line((x + 2, top + 26, x + 3, GY), fill=C(P['near_rim']))
    d.line((x, top + 34, x - 10, top + 22), fill=C(P['near']), width=2)
    d.line((x + 1, top + 30, x + 9, top + 20), fill=C(P['near']), width=2)
    blobs = [(x - 20, top + 16, 6), (x - 12, top + 20, 7), (x + 3, top + 21, 6), (x + 14, top + 18, 7),
             (x + 22, top + 12, 5), (x - 15, top + 6, 8), (x - 4, top + 10, 9), (x + 10, top + 6, 8),
             (x + 18, top + 2, 5), (x - 8, top - 4, 7), (x + 3, top - 7, 7), (x + 11, top - 3, 5), (x - 1, top + 2, 6)]
    foliage(img, blobs, P['leaf'], P['leaf_lit'], P['near_dk'], P['ink'])

def fence(d, x0, x1):
    y = GY - 15
    d.line((x0, y, x1, y), fill=C(P['near']), width=2)
    d.line((x0, y + 9, x1, y + 9), fill=C(P['near']))
    d.line((x0, y, x1, y), fill=C(P['near_rim']))
    for x in range(x0, x1 + 1, 5):
        d.line((x, y - 2, x, GY), fill=C(P['near']))
        d.point((x, y - 3), fill=C(P['near_rim']))

def bush(img, x, w, h):
    blobs = []
    for i, bx in enumerate(range(x + 4, x + w - 3, 5)):
        top = GY - h + 4 + (i * 5 % 4) - (2 if 0 < bx - x < w - 8 else 0)
        blobs += [(bx, top, 4 + (i * 7 % 3)), (bx + 2, GY - 3, 5)]
    foliage(img, blobs, P['leaf'], P['leaf_lit'], P['near_dk'], P['ink'])

def bench(d, x):
    """Скамейка: две доски спинки и сиденье, кромка света по верху досок."""
    for y in (GY - 15, GY - 11, GY - 7):
        d.rectangle((x, y, x + 27, y + 2), fill=C(P['near'])); d.line((x, y, x + 27, y), fill=C(P['near_rim']))
    for lx in (x + 3, x + 23):
        d.rectangle((lx, GY - 16, lx + 1, GY - 1), fill=C(P['near_dk']))

def column(d, x):
    """Афишная тумба без букв: цветные листы и светлая кромка со стороны солнца."""
    d.rectangle((x, GY - 40, x + 15, GY - 1), fill=C(P['near']))
    d.line((x + 15, GY - 40, x + 15, GY - 1), fill=C(P['near_rim']))
    d.polygon([(x - 1, GY - 40), (x + 7, GY - 47), (x + 16, GY - 40)], fill=C(P['near_dk']))
    d.line((x + 8, GY - 47, x + 16, GY - 40), fill=C(P['near_rim']))
    d.rectangle((x - 1, GY - 4, x + 16, GY - 1), fill=C(P['near_dk']))
    for bx, by, w, h, c in [(2, 34, 5, 9, '#f0b48c'), (8, 36, 5, 7, '#c4505a'), (3, 22, 9, 11, '#ffd27a'), (4, 18, 4, 3, '#8a4a6c')]:
        d.rectangle((x + bx, GY - by, x + bx + w - 1, GY - by + h - 1), fill=C(c))

def near():
    img, d = layer(W)
    fence(d, 166, 268); fence(d, 604, 690)
    tree(img, d, 294, 136); tree(img, d, 742, 140)
    for x, w, h in [(152, 24, 10), (266, 30, 12), (464, 34, 12), (596, 22, 10), (684, 28, 12)]:
        bush(img, x, w, h)
    bench(d, 512); column(d, 560)
    cafe(d, 14)
    return wrap(img, W, H)
