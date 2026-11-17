"""Тревога: холодная лиловая туча в тёплом мире — чужая по температуре, читается сразу.
Взъерошенный край, широко раскрытые глаза с точками-зрачками, искры, морось."""
import random
import numpy as np
from PIL import Image
from pix import C, Map, neighbors_empty, outline_mask

PAL = dict(out='#1c1838', dark='#2c2858', base='#433f7e', top='#6a64ac', rim='#9a92d8',
           eye='#f4f0ff', pupil='#14102a', brow='#14102a', spark='#ffe066', spark2='#fff6c0', rain='#7a74c0')

def anx(seed=2, look=-1):
    w, h = 46, 38
    m = Map(w, h)
    for box in [(5, 12, 21, 28), (12, 5, 30, 23), (24, 9, 40, 26), (9, 16, 37, 31), (2, 18, 14, 29), (31, 17, 43, 29)]:
        m.ell(box, 1)
    rnd = random.Random(seed)
    a = m.a.copy()
    for _ in range(48):  # взъерошенный край: выбросы по контуру
        ys, xs = np.nonzero(neighbors_empty(a, 0, -1) | neighbors_empty(a, 1, 0) | neighbors_empty(a, -1, 0))
        i = rnd.randrange(len(ys)); x, y = xs[i], ys[i]
        dx, dy = rnd.choice([(0, -1), (1, 0), (-1, 0), (1, -1), (-1, -1)])
        if 0 <= x + dx < w and 0 <= y + dy < h: a[y + dy, x + dx] = 1
    out = np.zeros((h, w, 4), np.uint8)
    out[a > 0] = C(PAL['base'])
    b1 = neighbors_empty(a, 0, 1); b2 = np.zeros_like(b1); b2[:-1] = b1[1:] & (a[:-1] > 0)
    out[b1 | b2] = C(PAL['dark'])
    t1 = neighbors_empty(a, 0, -1); t2 = np.zeros_like(t1); t2[1:] = t1[:-1] & (a[1:] > 0)
    out[t2 & ~b1] = C(PAL['top']); out[t1] = C(PAL['rim'])
    out[outline_mask(a)] = C(PAL['out'])
    img = Image.fromarray(out, 'RGBA').copy()
    px = img.load()
    def put(x, y, c): px[x, y] = C(PAL[c]) if isinstance(c, str) and c in PAL else C(c)
    # глаза: белые овалы 6x7, зрачок-точка смотрит на кота
    for ex in (15, 26):
        for yy in range(13, 20):
            for xx in range(ex, ex + 6):
                if ((xx - ex - 2.5) / 3.2) ** 2 + ((yy - 16) / 3.7) ** 2 <= 1: put(xx, yy, 'eye')
        cx = ex + (1 if look < 0 else 3)
        put(cx, 16, 'pupil'); put(cx + 1, 16, 'pupil'); put(cx, 17, 'pupil'); put(cx + 1, 17, 'pupil')
    for x, y in [(14, 11), (15, 11), (16, 10), (17, 10), (18, 10), (28, 10), (29, 10), (30, 10), (31, 11), (32, 11)]:
        put(x, y, 'brow')  # брови домиком — тревога
    for x, y in [(19, 23), (20, 22), (21, 23), (22, 22), (23, 23), (24, 22), (25, 23)]:
        put(x, y, 'out')   # дрожащий рот
    for sx, sy in [(1, 10), (41, 8), (39, 30)]:  # искры-молнии
        for x, y, c in [(sx + 2, sy, 'spark'), (sx + 1, sy + 1, 'spark'), (sx, sy + 2, 'spark2'),
                        (sx + 1, sy + 2, 'spark'), (sx + 2, sy + 2, 'spark'), (sx + 1, sy + 3, 'spark'), (sx, sy + 4, 'spark')]:
            put(x, y, c)
    for sx, sy in [(0, 19), (0, 22), (44, 18), (44, 21)]:  # дрожь — штрихи по бокам
        put(sx, sy, 'rim'); put(sx, sy + 1, 'rim')
    for x, y in [(12, 33), (19, 34), (27, 33), (33, 35), (22, 36)]:  # морось
        put(x, y, 'rain'); put(x - 1, y + 1, 'rain')
    return img
