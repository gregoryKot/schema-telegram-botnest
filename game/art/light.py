"""B2 (часть): уличный фонарь (эталон гл.1) и торшер со светом внутри спрайта (бриф, «Свет»).

Ореол и пятно на полу — ступени дизеринга (сплошное ядро, шахматка, редкая
сетка) в слое under под предметом: альфа только 0/255, а свет читается мягким.
Фонарь — в сетке x2; торшер — x1.5 до перерисовки дома.
"""
from PIL import Image, ImageDraw
from px import Canvas, Mat, C, PAL, OUT_WARM
from tile import BAYER4

SOLID, HALF, QUARTER = 'solid', 'half', 'quarter'

def _on(x, y, mode):
    if mode == SOLID:
        return True
    if mode == HALF:
        return (x + y) % 2 == 0
    return x % 2 == 0 and y % 2 == 0

def glow(c, cx, cy, rings):
    """rings: [(rx, ry, цвет, узор)] от внешнего к внутреннему; внутренний поверх."""
    for rx, ry, col, mode in rings:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
                if inside and 0 <= x < c.w and 0 <= y < c.h and _on(x, y, mode):
                    c.under.putpixel((x, y), C(col))

def streetlamp():
    """Фонарь 32x100 (показ x2, низ на 5 px утоплен в пол): чугун против солнца с тёплой
    кромкой справа, стекло светится, ореол — дизером по Байеру."""
    P = PAL['ch1']
    img = Image.new('RGBA', (32, 100), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    x, g, ly = 16, 95, 9                                  # ось, уровень земли, верх плафона
    for yy in range(ly - 9, ly + 20):                     # ореол вокруг плафона
        for xx in range(32):
            dd = ((xx - x) ** 2 + (yy - ly - 5) ** 2) ** .5
            if dd < 14 and BAYER4[yy % 4, xx % 4] < (14 - dd) / 14 * .5:
                img.putpixel((xx, yy), C('#ffe7a0'))
    iron, rim = C('#3a1a30'), C(P['near_rim'])
    d.rectangle((x - 3, g - 6, x + 3, g - 1), fill=iron); d.line((x + 3, g - 6, x + 3, g - 1), fill=rim)
    d.rectangle((x - 2, g - 9, x + 2, g - 6), fill=iron)
    d.rectangle((x - 1, g - 72, x, g - 9), fill=iron); d.line((x + 1, g - 72, x + 1, g - 9), fill=rim)
    d.rectangle((x - 2, g - 40, x + 2, g - 38), fill=iron)
    d.rectangle((x - 2, g - 74, x + 2, g - 72), fill=iron)
    d.polygon([(x - 5, ly), (x + 5, ly), (x + 3, ly + 11), (x - 3, ly + 11)], fill=iron)
    d.polygon([(x - 4, ly + 1), (x + 4, ly + 1), (x + 2, ly + 10), (x - 2, ly + 10)], fill=C('#ffe7a0'))
    d.line((x, ly + 1, x, ly + 10), fill=C('#ffc878')); d.point((x - 3, ly + 2), fill=C('#ffffff'))
    d.polygon([(x - 6, ly), (x, ly - 5), (x + 6, ly)], fill=iron); d.line((x, ly - 5, x + 6, ly), fill=rim)
    d.line((x, ly - 7, x, ly - 6), fill=iron)
    return img

SHADE, POLE, FOOT = 1, 2, 3

def floorlamp():
    """Торшер 72x116: абажур светится сам, тёплый ореол и пятно на полу."""
    c = Canvas(72, 116)
    cx = 36
    glow(c, cx, 22, [(34, 26, '#6e4c3a', QUARTER), (26, 20, '#9a6e54', HALF),
                     (18, 15, '#e8a860', HALF)])
    glow(c, cx, 111, [(34, 5, '#6e4c3a', QUARTER), (24, 4, '#9a6e54', HALF),
                      (14, 3, '#e8a860', HALF)])
    c.poly([(cx - 9, 10), (cx + 8, 10), (cx + 13, 32), (cx - 14, 32)], SHADE)
    c.rect((cx - 1, 33, cx, 104), POLE)
    c.poly([(cx - 7, 104), (cx + 6, 104), (cx + 9, 110), (cx - 10, 110)], FOOT)
    c.iline([(cx + 6, 33), (cx + 6, 42)], '#4a3228')                 # шнурок
    c.irect((cx + 5, 43, cx + 7, 45), '#e8cda0')
    c.iline([(cx - 13, 31), (cx + 12, 31)], '#e8a860')               # кромка абажура
    for x in range(cx - 10, cx + 10, 5):                             # складки ткани
        c.iline([(x, 13), (x - 2, 29)], '#e8c070')
    mats = {SHADE: Mat('#e8a860', '#ffd080', '#fff0c0', OUT_WARM, shade=1, dither=False),
            POLE: Mat('#4a3228', '#6e4c3a', '#9a6e54', OUT_WARM, z=-1),
            FOOT: Mat('#4a3228', '#6e4c3a', '#9a6e54', OUT_WARM)}
    return c.render(mats)

def build():
    return {'prop_streetlamp': streetlamp(), 'prop_lamp': floorlamp()}
