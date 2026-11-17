"""Кабинет гл.4 «Первый сеанс», рассвет (палитра DAWN) — самый светлый кадр игры: кремовые обои,
мятные панели, окно с восходом, кресло терапевта, столик с чашкой. Один фон 480x270: якорь — низ по
центру (на таче виден центр 320x180), пол — FLOOR px от низа. Координаты мебели — CHAIR_X, SEAT.
"""
from PIL import Image, ImageDraw
from px import C, PAL
from tile import BAYER4

P = PAL['dawn']
INK = P['ink']
W, H, FLOOR = 480, 270, 32
GY = H - FLOOR
CHAIR_X, SEAT = 270, 12                    # центр кресла и высота сиденья над полом (cabinetLayout.ts)
PAPER, PAT, CEIL, CEIL_DK = '#ffe0c0', '#fff0dc', '#fff8e0', '#e8d6c0'
PANEL, PANEL_HI, PANEL_DK, RAIL, RAIL_DK = '#9adcc0', '#c4f0dc', '#6cbca0', '#fff8e0', '#d8c4ae'
WOOD = ['#fff0d0', '#eac39a', '#dcae88', '#cc9a7a', '#bb886e']       # доски: от стены к зрителю
WOOD_LIT = ['#fff8e0', '#ffe4b8', '#fad6ac', '#f0c8a0', '#e4b894']    # те же доски в пятне солнца
JOINT, ROWS = '#a87860', [1, 5, 11, 20, 32]
SKY = [P['sky0'], P['sky1'], P['sky2'], P['sky3'], P['sky4']]
WX0, WY0, WX1, WY1 = 184, 56, 296, 172     # стекло окна

def _dith(k, x, y):
    """Ступень градиента с дизером на стыке."""
    return int(k) + (k % 1 > .5 and (k % 1 - .5) * 2 > BAYER4[y % 4, x % 4])

def _wall(px):
    for y in range(GY):
        a = GY - 1 - y
        for x in range(W):
            u = x % 32
            if y < 5: col = CEIL if y < 4 else CEIL_DK
            elif a < 2: col = P['stone_dk']
            elif a < 7: col = P['stone'] if a < 6 else CEIL
            elif a < 41:                                   # мятная панель с филёнкой
                col = PANEL
                if 4 <= u <= 27 and 11 <= a <= 37:
                    if a == 37 or u == 4: col = PANEL_DK
                    elif a == 11 or u == 27: col = PANEL_HI
            elif a == 41: col = PANEL_DK
            elif a == 42: col = RAIL_DK
            elif a < 45: col = RAIL
            else:
                col = PAPER
                p, q = (x + (8 if (a // 16) % 2 else 0)) % 16, a % 16
                if abs(p - 4) + abs(q - 8) <= 2 and (p, q) != (4, 8) or (p, q) == (12, 0): col = PAT
            px[x, y] = C(col)

def _floor(px):
    for y in range(GY, H):
        d = y - GY
        r = next(i for i, edge in enumerate(ROWS) if d < edge)
        for x in range(W):
            xl, xr = 150 - d * 3, 300 - d                 # пятно солнца из окна: трапеция к зрителю
            edge = min(x - xl, xr - x)
            lit = edge >= 3 or edge >= 0 and BAYER4[y % 4, x % 4] < (edge + 1) / 4
            tone = WOOD_LIT if lit else WOOD
            col = tone[r]
            if r and d == ROWS[r - 1]: col = JOINT if not lit else WOOD[r]
            elif r and (x + r * 37) % (26 + r * 9) == 0: col = JOINT if not lit else WOOD[r]
            px[x, y] = C(col)

def _glass():
    """Вид за стеклом: рассветное небо, солнце над холмами, крыши ловят первый свет."""
    w, h = WX1 - WX0 + 1, WY1 - WY0 + 1
    g = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(g)
    for y in range(h):
        k = y / (h - 1) * (len(SKY) - 1)
        for x in range(w):
            g.putpixel((x, y), C(SKY[min(len(SKY) - 1, _dith(k, x, y))]))
    for x0, x1, y in ((8, 42, 31), (62, 100, 36), (20, 56, 60)):               # облака: подсветка снизу
        d.line((x0, y, x1, y), fill=C('#fff8e0')); d.line((x0 + 4, y + 1, x1 - 3, y + 1), fill=C(P['sky4']))
    d.ellipse((54, 62, 90, 98), fill=C('#ffeccc')); d.ellipse((60, 68, 84, 92), fill=C(P['sun']))
    for box, col in (((-20, 92, 62, 150), '#cdbdea'), ((50, 96, 140, 150), '#cdbdea'), ((14, 100, 104, 160), P['lilac'])):
        d.ellipse(box, fill=C(col))                                                           # дальние холмы
    for x0, wd, top in ((20, 20, 94), (48, 26, 90), (80, 18, 97)):                            # дома
        d.rectangle((x0, top + 8, x0 + wd, h), fill=C(P['stone'])); d.rectangle((x0 + wd - 3, top + 8, x0 + wd, h), fill=C(P['stone_dk']))
        d.polygon(((x0 - 3, top + 8), (x0 + wd // 2, top), (x0 + wd + 3, top + 8)), fill=C(P['roof']))
        d.line((x0 - 3, top + 8, x0 + wd // 2, top), fill=C(P['sky4']))
        d.rectangle((x0 + 4, top + 12, x0 + 6, top + 15), fill=C(P['sun'])); d.rectangle((x0 + wd - 9, top + 12, x0 + wd - 7, top + 15), fill=C(P['sky0']))
    for cx, cy, r in ((4, 104, 10), (14, 110, 7), (106, 108, 9), (96, 113, 5)):               # кроны у окна
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=C(P['leaf']))
        d.ellipse((cx - r + 1, cy - r, cx + 1, cy - 2), fill=C(P['leaf_hi']))
    return g

def _window(img, d):
    img.paste(_glass(), (WX0, WY0))
    d.rectangle((WX0 - 4, WY0 - 4, WX1 + 4, WY1 + 4), outline=C(P['stone_dk']))
    for k in (3, 2, 1):
        d.rectangle((WX0 - k, WY0 - k, WX1 + k, WY1 + k), outline=C(CEIL if k < 3 else P['stone']))
    mx, my = (WX0 + WX1) // 2, WY0 + 44
    d.rectangle((mx - 1, WY0, mx, WY1), fill=C(CEIL)); d.line((mx + 1, WY0, mx + 1, WY1), fill=C(P['stone']))
    d.rectangle((WX0, my, WX1, my + 1), fill=C(CEIL)); d.line((WX0, my + 2, WX1, my + 2), fill=C(P['stone']))
    d.rectangle((WX0 - 8, WY1 + 5, WX1 + 8, WY1 + 9), fill=C(CEIL), outline=C(P['stone_dk']))  # подоконник
    d.line((WX0 - 7, WY1 + 8, WX1 + 7, WY1 + 8), fill=C(P['stone']))
    d.rectangle((WX0 - 18, WY0 - 12, WX1 + 18, WY0 - 10), fill=C('#c98f6c'), outline=C(JOINT))  # карниз штор
    for x0, side in ((WX0 - 16, 1), (WX1 + 5, -1)):                                           # тюль подхвачен по бокам
        for i in range(12):
            fold = (i if side > 0 else 11 - i) % 4
            d.line((x0 + i, WY0 - 9, x0 + i, WY1 + 12 + fold % 2), fill=C(('#c4b4e4', '#eee4f8', '#fff8e0', '#d8ccf0')[fold]))

def _box(d, box, base, hi, dk):
    """Тело с контуром: свет сверху-слева, тень снизу-справа."""
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=C(base), outline=C(INK))
    d.line((x0 + 1, y0 + 1, x1 - 1, y0 + 1), fill=C(hi)); d.line((x0 + 1, y0 + 1, x0 + 1, y1 - 1), fill=C(hi))
    d.line((x0 + 1, y1 - 1, x1 - 1, y1 - 1), fill=C(dk)); d.line((x1 - 1, y0 + 2, x1 - 1, y1 - 1), fill=C(dk))

def _furniture(d):
    lil, lil_hi, lil_dk = P['lilac'], '#d4c6f0', '#8e7ac4'
    d.ellipse((150, GY + 9, 330, GY + 27), fill=C(P['mint_dk']), outline=C(INK))               # ковёр
    d.ellipse((156, GY + 11, 324, GY + 25), outline=C(PANEL_HI)); d.ellipse((176, GY + 14, 304, GY + 22), outline=C(lil))
    cx = CHAIR_X                                                                               # кресло терапевта
    for x in (cx - 23, cx + 21): d.rectangle((x, GY - 4, x + 2, GY - 1), fill=C('#c98f6c'), outline=C(INK))
    _box(d, (cx - 22, GY - 58, cx + 22, GY - 12), lil, lil_hi, lil_dk)                         # спинка
    for x in (cx - 8, cx + 8): d.line((x, GY - 52, x, GY - 16), fill=C(lil_dk)); d.line((x + 1, GY - 52, x + 1, GY - 16), fill=C(lil_hi))
    _box(d, (cx - 24, GY - SEAT - 1, cx + 24, GY - 4), lil, lil_hi, lil_dk)                    # сиденье
    for x in (cx - 31, cx + 23): _box(d, (x, GY - 28, x + 8, GY - 4), lil, lil_hi, lil_dk)     # подлокотники
    tx = 220                                                                                   # столик: чашка, салфетки
    d.rectangle((tx - 1, GY - 18, tx + 1, GY - 2), fill=C('#c98f6c'), outline=C(INK))
    d.rectangle((tx - 7, GY - 2, tx + 7, GY - 1), fill=C(JOINT), outline=C(INK))
    _box(d, (tx - 13, GY - 22, tx + 13, GY - 18), '#eac39a', WOOD[0], '#bb886e')
    d.rectangle((tx - 10, GY - 28, tx - 4, GY - 23), fill=C(CEIL), outline=C(INK)); d.line((tx - 3, GY - 27, tx - 2, GY - 25), fill=C(INK))
    d.point((tx - 8, GY - 31), fill=C(CEIL)); d.point((tx - 6, GY - 33), fill=C(CEIL)); d.point((tx - 7, GY - 35), fill=C(CEIL))
    d.rectangle((tx + 2, GY - 27, tx + 11, GY - 23), fill=C(P['mint']), outline=C(INK)); d.line((tx + 5, GY - 29, tx + 8, GY - 29), fill=C(CEIL))
    _box(d, (118, 92, 150, 118), '#c98f6c', WOOD[1], JOINT)                                    # картина: тропа к свету
    d.rectangle((121, 95, 147, 115), fill=C(P['sky1'])); d.rectangle((121, 107, 147, 115), fill=C(P['leaf']))
    d.polygon(((132, 115), (136, 107), (138, 107), (140, 115)), fill=C(P['sky3'])); d.ellipse((134, 99, 140, 105), fill=C(P['sun']))
    d.ellipse((328, 84, 350, 106), fill=C(CEIL), outline=C(INK)); d.ellipse((329, 85, 349, 105), outline=C(P['mint_dk']))  # часы: утро
    d.line((339, 95, 339, 89), fill=C(INK)); d.line((339, 95, 344, 98), fill=C(P['roof']))

def room():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255)); px = img.load()
    _wall(px); _floor(px)
    d = ImageDraw.Draw(img)
    _window(img, d); _furniture(d)
    return img

def build():
    return {'bg_cabinet': room()}
