"""Люди «Недели»: один риг на всех. Кадр 40x60, показ x2, взгляд вправо; рост фигуры — около 50 px.

Поза — углы суставов в градусах от вертикали (вперёд — плюс); голова — ручной штамп,
тело и конечности — примитивы в карту материалов (px.Canvas), красит общий px.render.
Мимики нет: характер держат поза и силуэт, лицо — глаз в два пикселя. Тени уходят в синеву, свет — в тёплое.
"""
import math
from px import Canvas, Mat

FW, FH = 40, 60
GY = FH - 1
OUT = '#231a36'
(FAR_ARM, FAR_LEG, FAR_SHOE, PACK, STRAP, TORSO, LEG, SHOE, SOLE, HOOD, HAIR, SKIN, EYE, PHONES, CUP,
 ARM, HAND, BLANK, LID, PROP, PROP2, GLOW) = range(1, 23)
SKIN_A = ('#b9755c', '#e3a583', '#f6c9a8')

def mats(top, legs, hair, skin=SKIN_A, pack=None, prop=('#b98a5a', '#dcb07a', '#f2d3a2'), shoe=('#aab2cc', '#eef1f7', '#ffffff')):
    """Материалы фигуры: top/legs — рампы (тень, тон, свет); дальние конечности — на тон темнее."""
    far = lambda r: (r[0], r[0], r[1])
    m = {
        FAR_ARM: Mat(*far(top), out=OUT, z=1), FAR_LEG: Mat(*far(legs), out=OUT, z=1),
        FAR_SHOE: Mat(shoe[0], shoe[0], shoe[0], out=OUT, z=1, rim=False),
        TORSO: Mat(*top, out=OUT, z=3, shade=2, dither=False), LEG: Mat(*legs, out=OUT, z=2),
        SHOE: Mat(*shoe, out=OUT, z=2), SOLE: Mat('#5b6382', '#5b6382', '#5b6382', out=OUT, z=2, rim=False),
        HOOD: Mat(*top, out=OUT, z=5, shade=1, dither=False), HAIR: Mat(*hair, out=OUT, z=5),
        SKIN: Mat(*skin, out=OUT, z=4, shade=0, rim=False), EYE: Mat(OUT, OUT, OUT, out=OUT, z=4, shade=0, rim=False),
        LID: Mat(skin[0], skin[0], skin[0], out=OUT, z=4, shade=0, rim=False),
        PHONES: Mat('#231a36', '#3b3357', '#6a628c', out=OUT, z=6, shade=0),
        CUP: Mat('#aab2cc', '#eef1f7', '#ffffff', out=OUT, z=7, shade=1, dither=False),
        ARM: Mat(*top, out=OUT, z=8), HAND: Mat(*skin, out=OUT, z=8, shade=0, rim=False),
        BLANK: Mat('#cfc8e0', '#ece8f4', '#ffffff', out=OUT, z=4, shade=1, dither=False),
        PROP: Mat(*prop, out=OUT, z=9, shade=2), PROP2: Mat('#231a36', '#2c2a44', '#4a4870', out=OUT, z=9, shade=0),
        GLOW: Mat('#9fe8f0', '#d8fbff', '#ffffff', out=OUT, z=10, shade=0, rim=False),
    }
    if pack:
        m[PACK] = Mat(*pack, out=OUT, z=2, shade=2, dither=False)
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
    toe, heel = (x + 5 * dx, y + 5 * dy), (x - 1.5 * dx, y - 1.5 * dy)
    c.line([heel, toe], upper, 3)
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
    arms=(так же), feet=(наклоны стоп), head=(dx, dy), hold='phone'|'box'; look: mats, head, key, pack (0..1 — груз), phones."""
    c = Canvas(FW, FH)
    hx, hy = p['hip'][0], GY - p['hip'][1]
    lean = p.get('lean', 0)
    sx, sy = _pt(hx, hy, 180 - lean, 14)                       # плечи
    (fl, nl), (fa, na) = p['legs'], p['arms']
    feet = p.get('feet', (0, 0))
    ex, ey = _limb(c, hx + 1, hy, fl[0], fl[1], 10, 10, FAR_LEG, 5, 4)
    _shoe(c, ex, ey, feet[0], FAR_SHOE)
    fx, fy = _limb(c, sx + 1, sy + 2, fa[0], fa[1], 8, 7, FAR_ARM, 4, 3)
    load = look.get('pack')
    if load is not None:                                       # рюкзак за спиной: растёт с грузом
        bx, by, g = sx - 7, sy + 1, round(4 * load)
        c.d.rounded_rectangle((bx - 3 - g, by - g // 2, bx + 3, by + 12 + g), 3, fill=PACK)
    ex, ey = _limb(c, hx - 1, hy, nl[0], nl[1], 10, 10, LEG, 5, 4)
    _shoe(c, ex, ey, feet[1], SHOE, SOLE)
    w = look.get('width', 5)
    c.poly([(hx - w, hy + 2), (hx + w, hy + 2), (sx + w, sy), (sx + w - 1, sy - 1), (sx - w + 1, sy - 1), (sx - w, sy)], TORSO)
    if load is not None:
        c.line([(sx + 1, sy), (sx - 3, sy + 10)], STRAP, 2)
    hdx, hdy = p.get('head', (0, 0))
    rows = look['head']
    ox, oy = round(sx + 1 + lean / 5 + hdx) - len(rows[0]) // 2, round(sy - len(rows) + 1 + hdy)
    _stamp(c, rows, look['key'], ox, oy)
    if look.get('phones'):                                     # наушники на шее: дуга и чашка
        c.line([(sx - 4, sy), (sx + 3, sy)], PHONES, 2)
        c.ell((sx - 2, sy - 1, sx + 3, sy + 4), CUP)
    ex, ey = _limb(c, sx - 1, sy + 2, na[0], na[1], 8, 7, ARM, 4, 3)
    hold = p.get('hold')
    if hold == 'box':                                          # коробка в обеих руках
        c.rect((ex - 3, ey - 9, ex + 9, ey + 2), PROP)
        c.line([(ex - 3, ey - 5), (ex + 9, ey - 5)], PROP2, 1)
    c.ell((ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5), HAND)
    if hold == 'phone':                                        # телефон светит в лицо
        c.rect((ex, ey - 5, ex + 2, ey - 1), PROP2)
        c.line([(ex, ey - 4), (ex, ey - 2)], GLOW, 1)
    return c.render(look['mats'])
