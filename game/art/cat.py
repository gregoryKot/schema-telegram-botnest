"""Кот Мистер: перекраска базовых листов (A1) и риг поз копингов (A2).

A1 сохраняет силуэт и походку старых 48-px листов (опора стиля по брифу),
но красит их общим конвейером px.render: шерсть, кромка света, контур.
Позы рисуются ригом в единицах 48-px кадра; scale=2 даёт кадр 96 px
с честной детализацией, а не растянутые квадраты.
"""
import math
import numpy as np
from PIL import Image
from px import Canvas, Mat, render, OUT_CAT, C

FUR, FAR, NEAR, BELLY, LINE, HEAD, TAIL, TAILF = 1, 2, 3, 4, 5, 6, 7, 8
MATS = {
    FUR:   Mat('#1a1a22', '#2b2b36', '#4a4a5c', OUT_CAT, shade=2),
    FAR:   Mat('#121218', '#1a1a22', '#2b2b36', OUT_CAT, shade=1),
    NEAR:  Mat('#1a1a22', '#2b2b36', '#4a4a5c', OUT_CAT, shade=1),
    BELLY: Mat('#2b2b36', '#3a3a48', '#4a4a5c', OUT_CAT, shade=1),
    LINE:  Mat('#0e0b16', '#0e0b16', '#0e0b16', OUT_CAT, shade=0, rim=False),
}
def _z(m, z):
    n = Mat('#000000', '#000000', '#000000'); n.__dict__.update(m.__dict__); n.z = z; return n
# z — порядок слоёв: край переднего поверх заднего получает внутренний контур
MATS.update({FAR: _z(MATS[FAR], 0), TAIL: _z(MATS[FUR], 1), FUR: _z(MATS[FUR], 2),
             BELLY: _z(MATS[BELLY], 3), HEAD: _z(MATS[FUR], 4), NEAR: _z(MATS[NEAR], 5),
             TAILF: _z(MATS[FUR], 6), LINE: _z(MATS[LINE], 9)})
EYE, EYE_D, NOSE, STREAK = '#ffcc33', '#c8901e', '#d9738a', '#a89fd0'

# ---------- A1: перекраска старых листов ----------
OLD = {(38, 38, 38): FUR, (27, 27, 27): FAR, (19, 19, 19): LINE}
INK = {(250, 188, 19): EYE, (192, 145, 17): EYE_D, (140, 31, 86): NOSE}

def restyle(path):
    src = np.array(Image.open(path).convert('RGBA'))
    h, w = src.shape[:2]
    a = np.zeros((h, w), np.uint8)
    ink = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            r, g, b, al = src[y, x]
            if not al:
                continue
            key = (int(r), int(g), int(b))
            if key in INK:
                a[y, x] = FUR
                ink.putpixel((x, y), C(INK[key]))
            else:
                a[y, x] = OLD.get(key, FUR)
    # внешний контур старого листа срезаем — render нарисует его заново
    edge = [(x, y) for y in range(h) for x in range(w) if a[y, x] == LINE and any(
        not (0 <= x + dx < w and 0 <= y + dy < h) or (src[y + dy, x + dx][3] == 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        a[y, x] = 0
    return render(a, MATS, ink)

# ---------- A2: риг позы ----------
def oval(cx, cy, rx, ry, ang=0.0, n=28):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + rx * math.cos(t) * ca - ry * math.sin(t) * sa,
             cy + rx * math.cos(t) * sa + ry * math.sin(t) * ca)
            for t in (2 * math.pi * i / n for i in range(n))]

class Pose:
    """Все координаты — в единицах 48-px кадра, кот смотрит вправо."""
    def __init__(self, **kw):
        self.body = (24, 34, 11, 5.5, 0.0)      # cx, cy, rx, ry, наклон
        self.head = (36, 28, 6.0)               # cx, cy, r
        self.ears = (0.0, 0.0)                  # отклонение назад, рад (уши прижаты > 0)
        self.legs_far, self.legs_near = [], []  # [(плечо, колено, лапа)]
        self.tail = [(14, 33), (9, 28), (8, 20)]
        self.tail_w = 2.2
        self.tail_front = False                 # хвост поверх тела (клубок)
        self.eyes = 'open'                      # open | half | closed | none
        self.belly = None                       # oval брюха поверх тела
        self.streaks = []                       # линии движения (ink)
        self.__dict__.update(kw)

def draw(p, s=2, size=96):
    c = Canvas(size, size)
    S = lambda pts: [(x * s, y * s) for x, y in pts]
    lw = lambda w: max(1, round(w * s))
    for leg in p.legs_far:
        c.line(S(leg), FAR, lw(2.0))
    if not p.tail_front:
        c.line(S(p.tail), TAIL, lw(p.tail_w))
    bx, by, brx, bry, ba = p.body
    bry *= 0.85                                 # стройнее: силуэт как у базового кота
    c.poly(S(oval(bx, by, brx, bry, ba)), FUR)
    if p.belly:
        c.poly(S(oval(*p.belly)), BELLY)
    hx, hy, hr = p.head
    hr *= 0.88
    c.poly(S(oval(hx, hy, hr, hr * 0.9)), HEAD)
    for side, base in ((-1, -0.55), (1, 0.35)):   # заднее и переднее ухо
        a = base - p.ears[0 if side < 0 else 1] - math.pi / 2
        tip = (hx + math.cos(a) * hr * 1.55, hy + math.sin(a) * hr * 1.55)
        l = (hx + math.cos(a - 0.45) * hr * 0.85, hy + math.sin(a - 0.45) * hr * 0.85)
        r = (hx + math.cos(a + 0.45) * hr * 0.85, hy + math.sin(a + 0.45) * hr * 0.85)
        c.poly(S([l, tip, r]), HEAD)
    if p.tail_front:
        c.line(S(p.tail), TAILF, lw(p.tail_w))
    for leg in p.legs_near:
        c.line(S(leg), NEAR, lw(2.0))
        fx, fy = leg[-1]
        c.poly(S(oval(fx + 0.6, fy, 1.7, 1.1)), NEAR)
    _face(c, p, s)
    for pts in p.streaks:
        c.iline(S(pts), STREAK)
    return c.render(MATS)

def _face(c, p, s):
    hx, hy, hr = p.head
    hr *= 0.88
    ex, ey = round((hx + hr * 0.1) * s), round((hy - hr * 0.2) * s)
    nx, ny = round((hx + hr * 0.95) * s), round((hy + hr * 0.3) * s)
    gap = 4 * s                                 # как у базового кота: глаз 1x2, шаг 4
    for x in (ex, ex + gap):
        if p.eyes == 'open':
            c.irect((x, ey, x + s - 1, ey + s - 1), EYE); c.irect((x, ey + s, x + s - 1, ey + 2 * s - 1), EYE_D)
        elif p.eyes == 'half':
            c.irect((x, ey + s, x + s - 1, ey + 2 * s - 1), EYE)
        elif p.eyes == 'closed':
            c.iline([(x, ey + s), (x + s, ey + s)], '#4a4a5c')
    if p.eyes != 'none':
        c.dot(nx, ny, NOSE)
