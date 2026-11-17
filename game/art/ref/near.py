"""Ближний план главы 1: кафе с маркизой и тёплой витриной, дерево, ограда, кусты.
Темнее и теплее среднего плана; кромка — со стороны солнца."""
from PIL import Image, ImageDraw
from pix import C, foliage
from pal import CH1 as P
from sky import W, H, SUN
from city import GY

def cafe(d):
    x0, x1, top = -2, 66, 118
    d.rectangle((x0, top, x1, GY), fill=C(P['near']))
    d.line((x1, top, x1, GY), fill=C(P['near_rim']))
    d.line((x0, top, x1, top), fill=C(P['near_rim']))
    d.rectangle((x0, top - 4, x1 + 2, top - 1), fill=C(P['near_dk']))       # карниз
    d.line((x0, top - 4, x1 + 2, top - 4), fill=C(P['near_rim']))
    for wx in (8, 34):  # окна второго этажа, одно светится
        d.rectangle((wx, top + 8, wx + 12, top + 24), fill=C(P['near_dk']))
        if wx == 8:
            d.rectangle((wx + 1, top + 9, wx + 11, top + 23), fill=C(P['win']))
            d.rectangle((wx + 1, top + 9, wx + 4, top + 23), fill=C('#e89a5e'))  # штора
            d.point((wx + 10, top + 10), fill=C(P['win_hi']))
        d.line((wx - 1, top + 25, wx + 13, top + 25), fill=C(P['near_rim']))
    # маркиза в полоску
    ay = 156
    for i, x in enumerate(range(x0, x1 + 4, 6)):
        d.polygon([(x, ay), (x + 6, ay), (x + 8, ay + 9), (x + 2, ay + 9)],
                  fill=C('#c4505a' if i % 2 else '#f0b48c'))
    d.line((x0, ay - 1, x1 + 4, ay - 1), fill=C(P['near_dk']))
    for x in range(x0 + 1, x1 + 6, 4):  # фестоны
        d.point((x, ay + 10), fill=C('#c4505a'))
    # витрина: тёплый интерьер, силуэты столика и чашки
    d.rectangle((4, 170, 58, 206), fill=C(P['near_dk']))
    d.rectangle((6, 172, 56, 204), fill=C(P['win']))
    d.rectangle((6, 172, 56, 175), fill=C(P['win_hi']))
    d.line((31, 172, 31, 204), fill=C(P['near_dk']))
    for tx in (14, 42):
        d.rectangle((tx - 5, 194, tx + 5, 195), fill=C('#a8584a')); d.line((tx, 196, tx, 204), fill=C('#a8584a'))
        d.rectangle((tx - 2, 191, tx, 193), fill=C('#c86a50'))
    d.ellipse((18, 178, 24, 184), fill=C('#ffe7a8'))  # лампа-шар внутри
    d.rectangle((2, 206, 62, GY), fill=C(P['near_dk']))
    d.line((2, 206, 62, 206), fill=C(P['near_rim']))
    # терракотовый горшок с геранью у входа — тёплый, светлее кота, не путается с ним
    d.polygon([(71, 203), (83, 203), (81, GY), (73, GY)], fill=C(P['pave']))
    d.rectangle((70, 201, 84, 203), fill=C(P['curb']))
    d.line((70, 201, 84, 201), fill=C(P['curb_hi']))
    d.line((83, 204, 81, GY), fill=C(P['curb'])); d.line((72, 207, 82, 207), fill=C(P['pave_sh']))
    for x, y, c in [(73, 199, '#7ea04a'), (75, 197, '#7ea04a'), (77, 198, '#5e8040'), (79, 196, '#7ea04a'),
                    (81, 198, '#7ea04a'), (74, 196, '#ff8aa0'), (78, 194, '#ff6a84'), (82, 196, '#ff8aa0'),
                    (76, 199, '#5e8040'), (80, 199, '#5e8040'), (78, 195, '#ffd36a')]:
        d.point((x, y), fill=C(c))

def tree(img, x, top):
    d = ImageDraw.Draw(img)
    d.polygon([(x - 3, GY), (x - 2, top + 26), (x + 2, top + 26), (x + 3, GY)], fill=C(P['near']))
    d.line((x + 2, top + 26, x + 3, GY), fill=C(P['near_rim']))
    d.line((x, top + 34, x - 10, top + 22), fill=C(P['near']), width=2)
    d.line((x + 1, top + 30, x + 9, top + 20), fill=C(P['near']), width=2)
    blobs = [(x - 20, top + 16, 6), (x - 12, top + 20, 7), (x + 3, top + 21, 6), (x + 14, top + 18, 7), (x + 22, top + 12, 5),
             (x - 15, top + 6, 8), (x - 4, top + 10, 9), (x + 10, top + 6, 8), (x + 18, top + 2, 5),
             (x - 8, top - 4, 7), (x + 3, top - 7, 7), (x + 11, top - 3, 5), (x - 1, top + 2, 6)]
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
    blobs = []; i = 0
    for bx in range(x + 4, x + w - 3, 5):
        r = 4 + (i * 7 % 3); top = GY - h + 4 + (i * 5 % 4) - (2 if 0 < bx - x < w - 8 else 0)
        blobs.append((bx, top, r)); blobs.append((bx + 2, GY - 3, 5)); i += 1
    foliage(img, blobs, P['leaf'], P['leaf_lit'], P['near_dk'], P['ink'])

def near():
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    fence(d, 150, 252)
    tree(img, 278, 136)
    bush(img, 136, 24, 10); bush(img, 250, 30, 12); bush(img, 448, 34, 12)
    cafe(d)
    return img
