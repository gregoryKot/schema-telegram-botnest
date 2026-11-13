"""A5: улица гл.1, три бесшовных по горизонтали слоя (показ x2, как пол).

far 240x110 — силуэты крыш, антенны, водонапорная башня (небо не рисуем);
mid 320x130 — фасады 2–3 этажа, тёплые и тёмные окна, балконы, водостоки;
near 160x60 — ограда, бак, афишная тумба без букв, куст.
Бесшовность: сцена рисуется трижды подряд, рендерится и режется середина —
контур и свет на стыке совпадают сами.
"""
import random
from px import Canvas, Mat, OUT_COOL

LAMP = ('#ffd080', '#e8a860', '#9a6aaa')        # окно: свет, ободок, ореол

def tiled(w, h, paint, mats, seed):
    c = Canvas(w * 3, h)
    for k in range(3):
        paint(c, k * w, random.Random(seed))
    return c.render(mats).crop((w, 0, 2 * w, h))

def _window(c, x, y, w, h, lit):
    if lit:
        c.irect((x - 1, y - 1, x + w, y + h), LAMP[2])    # ореол запечён в спрайт
        c.irect((x, y, x + w - 1, y + h - 1), LAMP[1])
        c.irect((x, y, x + w - 2, y + h - 2), LAMP[0])
    else:
        c.irect((x, y, x + w - 1, y + h - 1), '#1f1834')
        c.dot(x, y, '#3a3458')

# ---------- far ----------
FAR = {1: Mat('#33295a', '#3a2f62', '#4a3d70', OUT_COOL, shade=0)}  # дымка: светлее среднего плана

def far(c, ox, rnd):
    H, x = 110, 0
    while x < 240:
        bw, bh = rnd.randrange(22, 44), rnd.randrange(56, 100)
        if x + bw > 240:
            bw = 240 - x
        c.rect((ox + x, H - bh, ox + x + bw - 1, H - 1), 1)
        if rnd.random() < 0.4:                            # антенна
            ax = ox + x + rnd.randrange(3, max(4, bw - 3))
            c.line([(ax, H - bh - 9), (ax, H - bh)], 1)
            c.line([(ax - 3, H - bh - 6), (ax + 3, H - bh - 6)], 1)
        for _ in range(rnd.randrange(0, 3)):              # редкие далёкие окна
            c.dot(ox + x + rnd.randrange(2, max(3, bw - 2)), H - bh + rnd.randrange(4, bh - 4), '#7a5a7a')
        x += bw
    tx = ox + 150                                         # водонапорная башня
    c.rect((tx, H - 104, tx + 13, H - 92), 1)
    c.poly([(tx - 1, H - 104), (tx + 6, H - 109), (tx + 14, H - 104)], 1)
    for lx in (tx + 2, tx + 11):
        c.line([(lx, H - 92), (lx, H - 70)], 1)

# ---------- mid ----------
WALLS = [('#241c3a', '#2e2548', '#3e3360'), ('#2a1f3a', '#362848', '#4a3858'), ('#221c38', '#2c2546', '#3a325a')]
MID = {i + 1: Mat(*w, OUT_COOL, shade=2) for i, w in enumerate(WALLS)}
MID[4] = Mat('#1f1834', '#2c2348', '#3a3458', OUT_COOL, z=1)          # балконы, карнизы
MID[5] = Mat('#1f1834', '#2a2440', '#3a3458', OUT_COOL, shade=0, z=2)  # водосток

def mid(c, ox, rnd):
    H, x, i = 130, 0, 0
    # (ширина дома, просвет после него): сумма = 320, стык — в просвете
    for (bw, gap), floors in zip(((64, 10), (78, 14), (70, 8), (76, 0)), (3, 2, 3, 2)):
        fh = 26
        top = H - floors * fh - 6
        mat = 1 + i % 3
        c.rect((ox + x + 1, top, ox + x + bw - 2, H - 1), mat)
        c.rect((ox + x, top - 2, ox + x + bw - 1, top), 4)                # карниз крыши
        c.line([(ox + x + bw - 4, top + 1), (ox + x + bw - 4, H - 1)], 5, 2)  # водосток
        cols = (bw - 12) // 16
        for f in range(floors):
            wy = top + 6 + f * fh
            for k in range(cols):
                wx = ox + x + 8 + k * 16
                _window(c, wx, wy, 7, 11, rnd.random() < 0.42)
            if f and rnd.random() < 0.5:                  # балкон с решёткой
                bx = ox + x + 6 + rnd.randrange(cols) * 16
                c.rect((bx - 2, wy + 12, bx + 11, wy + 13), 4)
                for gx in range(bx - 2, bx + 12, 3):
                    c.iline([(gx, wy + 14), (gx, wy + 17)], '#1f1834')
                c.iline([(bx - 2, wy + 17), (bx + 11, wy + 17)], '#1f1834')
        if i == 2:                                        # пустая вывеска над витриной
            c.irect((ox + x + 14, H - 24, ox + x + 50, H - 17), '#1a1426')
            c.irect((ox + x + 15, H - 23, ox + x + 49, H - 18), '#5e4878')
            c.iline([(ox + x + 15, H - 23), (ox + x + 49, H - 23)], '#88ffcc')
        x += bw + gap; i += 1

# ---------- near ----------
NEAR = {1: Mat('#151022', '#1f1834', '#2c2348', OUT_COOL, shade=0),            # ограда
        2: Mat('#1f1834', '#2a2440', '#3e3360', OUT_COOL, shade=2, z=1),       # бак
        3: Mat('#2c2348', '#3a3458', '#5e4878', OUT_COOL, shade=2, z=1),       # тумба
        4: Mat('#22301e', '#2c3a26', '#3f5036', OUT_COOL, shade=2, z=2)}       # куст

def near(c, ox, rnd):
    H = 60
    c.rect((ox, H - 22, ox + 159, H - 21), 1)             # перила ограды
    for x in range(0, 160, 6):
        c.rect((ox + x, H - 22, ox + x, H - 1), 1)
        c.dot(ox + x, H - 24, '#1f1834')
    c.rect((ox + 24, H - 18, ox + 37, H - 1), 2)          # мусорный бак
    c.rect((ox + 23, H - 20, ox + 38, H - 18), 2)
    c.rect((ox + 80, H - 46, ox + 95, H - 1), 3)          # афишная тумба
    c.poly([(ox + 79, H - 46), (ox + 87, H - 52), (ox + 96, H - 46)], 3)
    c.irect((ox + 83, H - 40, ox + 92, H - 22), '#5e4878')
    c.irect((ox + 84, H - 39, ox + 91, H - 30), '#b07ab2')  # афиша без букв — цветное пятно
    c.ell((ox + 118, H - 20, ox + 146, H + 6), 4)         # куст
    c.ell((ox + 130, H - 26, ox + 150, H + 2), 4)

def build():
    return {'bg_street_far': tiled(240, 110, far, FAR, 'far'),
            'bg_street_mid': tiled(320, 130, mid, MID, 'mid'),
            'bg_street_near': tiled(160, 60, near, NEAR, 'near')}
