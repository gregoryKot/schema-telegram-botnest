"""Люди «Недели»: один риг на всех — Саша, коллеги. Кадр 44x72, показ x2, взгляд вправо.

Поза — углы суставов в градусах от вертикали (вперёд — плюс); голова — ручной штамп,
тело и конечности — примитивы в карту материалов (px.Canvas), красит общий px.render.
Мимики нет: характер держат поза и силуэт, лицо — один пиксель глаза.
"""
import math
from px import Canvas, Mat

FW, FH = 44, 72
GY = FH - 1
OUT = '#2b2730'
(FAR_ARM, FAR_LEG, FAR_SHOE, PACK, STRAP, TORSO, LEG, SHOE, SOLE, HOOD, HAIR, SKIN, EYE, PHONES, CUP,
 ARM, HAND, BLANK, LID) = range(1, 20)

def mats(top, top_far, legs, legs_far, hair, skin=('#a87f6c', '#c9a28c', '#dcb8a0'), pack=None):
    """Материалы фигуры: top/legs — рампы (тень, тон, свет) одежды, *_far — дальние конечности."""
    m = {
        FAR_ARM: Mat(*top_far, out=OUT, z=1), FAR_LEG: Mat(*legs_far, out=OUT, z=1),
        FAR_SHOE: Mat('#8e8a84', '#b8b4aa', '#b8b4aa', out=OUT, z=1, rim=False),
        TORSO: Mat(*top, out=OUT, z=3, shade=2), LEG: Mat(*legs, out=OUT, z=2),
        SHOE: Mat('#b8b4aa', '#e6e2d8', '#f4f1ea', out=OUT, z=2), SOLE: Mat('#6e6a66', '#8e8a84', '#8e8a84', out=OUT, z=2, rim=False),
        HOOD: Mat(*top, out=OUT, z=5, shade=2), HAIR: Mat(*hair, out=OUT, z=5),
        SKIN: Mat(*skin, out=OUT, z=4, shade=0, rim=False), EYE: Mat(OUT, OUT, OUT, out=OUT, z=4, shade=0, rim=False),
        LID: Mat(skin[0], skin[0], skin[0], out=OUT, z=4, shade=0, rim=False),
        PHONES: Mat('#2b2730', '#3e3c44', '#5e5c66', out=OUT, z=6, shade=0), CUP: Mat('#b8b4aa', '#e6e2d8', '#f4f1ea', out=OUT, z=7, shade=1, dither=False),
        ARM: Mat(*top, out=OUT, z=8), HAND: Mat(*skin, out=OUT, z=8, shade=0, rim=False),
        BLANK: Mat('#a8a49c', '#c4bfb4', '#d8d2c4', out=OUT, z=4, shade=1, dither=False),
    }
    if pack:
        m[PACK] = Mat(*pack, out=OUT, z=2, shade=2)
        m[STRAP] = Mat(pack[0], pack[0], pack[1], out=OUT, z=4, shade=0, rim=False)
    return m

def _pt(x, y, ang, ln):
    a = math.radians(ang)
    return x + ln * math.sin(a), y + ln * math.cos(a)

def _limb(c, x, y, a1, a2, l1, l2, mat, w1, w2):
    """Две кости от (x, y): возвращает конец второй."""
    kx, ky = _pt(x, y, a1, l1)
    ex, ey = _pt(kx, ky, a2, l2)
    c.line([(x, y), (kx, ky)], mat, w1)
    c.ell((kx - w2 / 2, ky - w2 / 2, kx + w2 / 2, ky + w2 / 2), mat)
    c.line([(kx, ky), (ex, ey)], mat, w2)
    return ex, ey

def _shoe(c, x, y, ang, upper, sole=None):
    """Кед у конца голени: носок вперёд, пятка назад; ang — наклон стопы (0 — плашмя)."""
    a = math.radians(ang)
    dx, dy = math.cos(a), -math.sin(a)
    toe, heel = (x + 6 * dx, y + 6 * dy), (x - 2 * dx, y - 2 * dy)
    c.line([heel, toe], upper, 4)
    if sole:
        c.line([(heel[0], heel[1] + 2), (toe[0], toe[1] + 2)], sole, 1)

def _stamp(c, rows, key, x, y):
    px = c.m.load()
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in key and 0 <= x + i < c.w and 0 <= y + j < c.h:
                px[x + i, y + j] = key[ch]

def figure(p, look):
    """Поза p + внешность look -> RGBA-кадр. p: hip=(x, выс. над землёй), lean, legs=((бедро, голень)x2: дальняя, ближняя),
    arms=(так же), feet=(наклоны стоп), head=(dx, dy), face; look: mats, head, key, pack, phones."""
    c = Canvas(FW, FH)
    hx, hy = p['hip'][0], GY - p['hip'][1]
    lean = p.get('lean', 0)
    sx, sy = _pt(hx, hy, 180 - lean, 18)                       # плечи
    (fl, nl), (fa, na) = p['legs'], p['arms']
    feet = p.get('feet', (0, 0))
    # дальние конечности
    ex, ey = _limb(c, hx + 1, hy, fl[0], fl[1], 13, 12, FAR_LEG, 6, 5)
    _shoe(c, ex, ey, feet[0], FAR_SHOE)
    hx2, hy2 = _limb(c, sx + 1, sy + 3, fa[0], fa[1], 10, 9, FAR_ARM, 4, 4)
    c.ell((hx2 - 2, hy2 - 2, hx2 + 2, hy2 + 2), FAR_ARM)
    # рюкзак за спиной
    if look.get('pack'):
        bx, by = sx - 8, sy + 2
        c.d.rounded_rectangle((bx - 4, by, bx + 4, by + 16), 3, fill=PACK)
    # ближняя нога, торс
    ex, ey = _limb(c, hx - 1, hy, nl[0], nl[1], 13, 12, LEG, 6, 5)
    _shoe(c, ex, ey, feet[1], SHOE, SOLE)
    w = look.get('width', 6)
    c.poly([(hx - w, hy + 2), (hx + w, hy + 2), (sx + w, sy), (sx + w - 1, sy - 1), (sx - w + 1, sy - 1), (sx - w, sy)], TORSO)
    if look.get('pack'):
        c.line([(sx + 1, sy), (sx - 3, sy + 13)], STRAP, 2)
    # голова
    hdx, hdy = p.get('head', (0, 0))
    rows = look['head']
    ox, oy = round(sx + 1 + lean / 5 + hdx) - len(rows[0]) // 2, round(sy - len(rows) + hdy)
    _stamp(c, p.get('face') or rows, look['key'], ox, oy)
    if look.get('phones'):                                     # наушники на шее: дуга и чашка
        c.line([(sx - 5, sy), (sx + 4, sy)], PHONES, 3)
        c.ell((sx - 2, sy - 1, sx + 4, sy + 6), CUP)
    # ближняя рука
    ex, ey = _limb(c, sx - 1, sy + 3, na[0], na[1], 10, 9, ARM, 5, 4)
    c.ell((ex - 2, ey - 2, ex + 2, ey + 2), HAND)
    return c.render(look['mats'])
