"""B2 (часть): уличный фонарь и торшер со светом внутри спрайта (бриф, «Свет»).

Ореол и пятно на полу — ступени дизеринга (сплошное ядро, шахматка, редкая
сетка) в слое under под предметом: альфа только 0/255, а свет читается мягким.
Показ x1.5, как кот.
"""
from px import Canvas, Mat, C, OUT_COOL, OUT_WARM

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

IRON, GLASS, BASE = 1, 2, 3

def streetlamp():
    """Фонарь 64x116: фонарь-фонарик на столбе, ореол сирени и тёплое пятно."""
    c = Canvas(64, 116)
    cx = 32
    glow(c, cx, 14, [(26, 22, '#5e4878', QUARTER), (19, 16, '#9a6aaa', HALF),
                     (12, 11, '#b07ab2', HALF)])
    glow(c, cx, 112, [(30, 4, '#9a6aaa', QUARTER), (20, 3, '#e8a860', HALF)])
    c.rect((cx - 1, 0, cx, 2), IRON)                                 # шпиль
    c.poly([(cx - 8, 7), (cx + 7, 7), (cx + 3, 3), (cx - 4, 3)], IRON)  # крыша
    c.rect((cx - 6, 8, cx + 5, 19), GLASS)                           # стекло
    c.rect((cx - 7, 20, cx + 6, 21), IRON)
    c.rect((cx - 2, 22, cx + 1, 25), IRON)                           # шейка
    c.rect((cx - 1, 26, cx, 104), IRON)                              # столб
    c.poly([(cx - 5, 104), (cx + 4, 104), (cx + 6, 110), (cx - 7, 110)], BASE)
    c.rect((cx - 9, 110, cx + 8, 112), BASE)
    for x in (cx - 3, cx + 2):                                       # переплёт
        c.iline([(x, 8), (x, 19)], '#c48a50')
    c.iline([(cx - 6, 13), (cx + 5, 13)], '#c48a50')
    c.irect((cx - 5, 9, cx - 4, 11), '#fff0c0')                      # блик сверху-слева
    mats = {IRON: Mat('#1a1426', '#3a3048', '#5e4878', OUT_COOL, z=1),
            GLASS: Mat('#e8a860', '#ffd080', '#fff0c0', OUT_WARM, shade=1, dither=False),
            BASE: Mat('#1a1426', '#2c2348', '#4a3d66', OUT_COOL)}
    return c.render(mats)

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
