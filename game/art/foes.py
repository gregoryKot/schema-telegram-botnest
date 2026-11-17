"""Враги гл.1 на сетке x2: Тревога, Раздражение, Самокритик. Контур у всех холодный (ink_cool) —
в тёплой сцене они чужие по температуре. Тревога и Самокритик — индиго, Раздражение — колючий жар.
"""
import random
import numpy as np
from PIL import Image, ImageDraw
from px import C, empty_at, outline_mask, strip
import cat, poses

OUT = '#1c1838'
ANX = dict(dark='#2c2858', base='#433f7e', top='#6a64ac', rim='#9a92d8', eye='#f4f0ff', pupil='#14102a',
           spark='#ffe066', spark2='#fff6c0', rain='#7a74c0')
AW, AH = 60, 50                      # кадр Тревоги: в него влезает крупная ступень
BLOBS = [(5, 12, 21, 28), (12, 5, 30, 23), (24, 9, 40, 26), (9, 16, 37, 31), (2, 18, 14, 29), (31, 17, 43, 29)]
BOLT = [(2, 0, 0), (1, 1, 0), (0, 2, 1), (1, 2, 0), (2, 2, 0), (1, 3, 0), (0, 4, 0)]

def below2(a):
    b1 = empty_at(a, 0, 1); b2 = np.zeros_like(b1); b2[:-1] = b1[1:] & (a[:-1] > 0)
    return b1, b2

def anx(k, f):
    """Туча размера k (1 — эталон 46x38), кадр f: край ерошится, дрожат зрачки, искры и морось по очереди."""
    cx, cy = AW // 2, AH // 2 - 2
    sq = (0, 1, -1)[f]                # дыхание: шире-ниже / уже-выше
    img = Image.new('L', (AW, AH), 0); d = ImageDraw.Draw(img)
    for x0, y0, x1, y1 in BLOBS:
        d.ellipse((cx + (x0 - 23) * k - sq, cy + (y0 - 18) * k + sq, cx + (x1 - 23) * k + sq, cy + (y1 - 18) * k), fill=1)
    a = np.array(img); rnd = random.Random(7 + f)
    for _ in range(int(48 * k)):
        ys, xs = np.nonzero(empty_at(a, 0, -1) | empty_at(a, 1, 0) | empty_at(a, -1, 0))
        i = rnd.randrange(len(ys)); x, y = xs[i], ys[i]
        dx, dy = rnd.choice([(0, -1), (1, 0), (-1, 0), (1, -1), (-1, -1)])
        if 1 <= x + dx < AW - 1 and 1 <= y + dy < AH - 1: a[y + dy, x + dx] = 1
    out = np.zeros((AH, AW, 4), np.uint8)
    out[a > 0] = C(ANX['base'])
    b1, b2 = below2(a); out[b1 | b2] = C(ANX['dark'])
    t1 = empty_at(a, 0, -1); t2 = np.zeros_like(t1); t2[1:] = t1[:-1] & (a[1:] > 0)
    out[t2 & ~b1] = C(ANX['top']); out[t1] = C(ANX['rim'])
    out[empty_at(a, 1, 0) & ~b1 & ~t1] = C(ANX['top'])      # солнце справа — отсвет по правому краю
    out[outline_mask(a)] = C(OUT)
    def put(x, y, c):
        if 0 <= x < AW and 0 <= y < AH: out[int(y), int(x)] = C(ANX.get(c, c))
    ew, eh = (4, 5) if k < .8 else (6, 7) if k < 1.2 else (7, 8)
    ey = round(cy - 5 * k); gap = round(2.5 * k)
    for ex in (cx - gap - ew, cx + gap):
        for yy in range(eh):
            for xx in range(ew):
                if ((xx - (ew - 1) / 2) / (ew / 2 + .2)) ** 2 + ((yy - (eh - 1) / 2) / (eh / 2 + .2)) ** 2 <= 1:
                    put(ex + xx, ey + yy, 'eye')
        px_, py_ = ex + (1 if f != 2 else 2), ey + eh // 2 - (1 if f != 1 else 0)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)) if k >= .8 else ((0, 0), (0, 1)):
            put(px_ + dx, py_ + dy, 'pupil')
        left = ex < cx; n = ew - 1; low = max(1, ew // 3)   # брови домиком: внутренний конец выше
        for i in range(n):
            x = ex - 1 + i if left else ex + 2 + i
            put(x, ey - (2 if (i < low if left else i >= n - low) else 3), 'pupil')
    mw = 3 if k < .8 else 7 if k < 1.2 else 9
    for i in range(mw):               # дрожащий рот
        put(cx - mw // 2 + i, ey + eh + 3 - (i + f) % 2, OUT)
    xs = np.nonzero(a.any(axis=0))[0]; ys = np.nonzero(a.any(axis=1))[0]
    l, r, top, bot = xs[0], xs[-1], ys[0], ys[-1]
    for n, (sx, sy) in enumerate([(l - 3, top + 3), (r - 1, top), (r - 3, bot - 5)]):
        if (n + f) % 3 != 2 and k >= .8 or n == f:
            for x, y, hot in BOLT: put(sx + x, sy + y, 'spark2' if hot else 'spark')
    for n, sx in enumerate((l - 2, r + 2)):               # дрожь — штрихи по бокам
        y0 = (top + bot) // 2 + (2 if (n + f) % 2 else -1)
        put(sx, y0, 'rim'); put(sx, y0 + 1, 'rim')
    for n in range(5 if k >= .8 else 3):                  # морось
        x = l + 6 + n * (r - l - 10) // 4; y = bot + 2 + (n * 2 + f) % 3
        if y + 1 < AH: put(x, y, 'rain'); put(x - 1, y + 1, 'rain')
    return Image.fromarray(out, 'RGBA')

IRR = dict(edge='#b0203f', red='#e8384a', hot='#ff7a3a', core='#ffc23a', white='#fff3c4', ink='#3a0a1c')
IW = 30

def irrit(f):
    """Раздражение: багровый колючий комок под языками пламени, злые глаза горят. Пламя и шипы пляшут по кадрам."""
    img = Image.new('L', (IW, IW), 0); d = ImageDraw.Draw(img)
    d.ellipse((5, 12, 24, 27), fill=1)
    lean = (0, 1, -1, 1)[f]; tall = (0, 2, 1, 3)[f]; j = f % 2
    d.polygon([(7, 16), (8, 8 + j), (11, 12), (14 + lean, 4 - tall), (18, 11), (21, 7 + 2 * j - tall // 2), (22, 16)], fill=1)
    for n, (bx, by, tx, ty) in enumerate([(6, 17, 3, 14), (6, 22, 2, 23), (9, 25, 6, 28),
                                         (23, 17, 26, 14), (23, 22, 27, 23), (20, 25, 23, 28)]):
        k = (n + f) % 2               # шипы дышат на пиксель
        tx += (tx > 15) * k - (tx < 14) * k
        d.polygon([(bx, by - 2), (tx, ty), (bx, by + 2)], fill=1)
    a = np.array(img); yy = np.arange(IW)[:, None] * np.ones((1, IW), int)
    edge = a.astype(bool) & (empty_at(a, 0, -1) | empty_at(a, 0, 1) | empty_at(a, 1, 0) | empty_at(a, -1, 0))
    out = np.zeros((IW, IW, 4), np.uint8)
    out[a > 0] = C(IRR['red'])
    out[edge] = C(IRR['edge'])
    b1, b2 = below2(a); out[b2 & ~edge & ((yy + np.arange(IW)) % 2 == 0)] = C(IRR['edge'])
    out[edge & (empty_at(a, 0, -1) | empty_at(a, 1, 0)) & ~empty_at(a, 0, 1)] = C(IRR['hot'])   # небо сверху, солнце справа
    crest = (a > 0) & (yy <= 12)      # пламя: чем выше, тем горячее
    out[crest & ~edge] = C(IRR['hot']); out[crest & edge] = C(IRR['red'])
    out[crest & ~edge & (yy <= 9 - tall // 2)] = C(IRR['core'])
    out[crest & edge & (yy <= 5)] = C(IRR['hot'])
    out[outline_mask(a)] = C(OUT)
    im = Image.fromarray(out, 'RGBA'); p = ImageDraw.Draw(im)
    for ex, s in ((9, 1), (17, -1)):                      # глаза-щели под тяжёлыми бровями
        p.rectangle((ex, 17, ex + 3, 19), fill=C(IRR['core']))
        p.point((ex + (0 if s > 0 else 3), 19), fill=C(IRR['white']))
        o, i = (ex - 1, ex + 4) if s > 0 else (ex + 4, ex - 1)
        p.polygon([(o, 15), (i, 17), (i, 18), (o, 16)], fill=C(IRR['ink']))
        p.line((ex + (2 if s > 0 else 1), 18, ex + (2 if s > 0 else 1), 19), fill=C(IRR['ink']))
    m = 22 + j
    p.line((12, m, 17, m), fill=C(IRR['ink'])); p.point((11, m + 1), fill=C(IRR['ink'])); p.point((18, m + 1), fill=C(IRR['ink']))
    for ex, ey in [((3, 4), (25, 6), (6, 2), (24, 3))[f], ((26, 9), (4, 8), (22, 4), (7, 6))[f]]:   # угольки
        p.point((ex, ey), fill=C(IRR['core']))
    return im

# Самокритик — тот же кот в том же риге, но из холода: «он же ты», только чужой сцене
COLD = dict(out=OUT, base='#2a2a5c', dark='#1f1d48', top='#433f7e', rim='#6a64ac', rim2='#9a92d8',
            far='#232150', lite='#35336a', earin='#433f7e', iris='#dfe6ff', lid='#ffffff', pup='#14102a',
            glint='#ffffff', nose='#6a64ac', mouth='#14102a')

def critic(fn, n):
    return strip([cat.paint(cat.pose(p), COLD, p.get('seam', False)) for p in fn()[:n]])

def build():
    return {
        'enemy_anx': strip([anx(k, f) for k in (1, .68, 1.22) for f in range(3)]),   # ступени: обычная, малая, крупная
        'enemy_irrit': strip([irrit(f) for f in range(4)]),
        'critic_idle': critic(poses.idle, 12), 'critic_run': critic(poses.run, 6),
    }
