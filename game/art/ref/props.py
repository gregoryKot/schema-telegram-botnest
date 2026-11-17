"""Игровой слой главы 1: земля с ямой, уступ, фонарь, сердце, Тревога."""
import random
import numpy as np
from PIL import Image, ImageDraw
from pix import C, Map, BAYER4, neighbors_empty, outline_mask
from pal import CH1 as P
from sky import W, H
from city import GY

def ground(pit):
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img); rnd = random.Random(5)
    px0, px1 = pit
    for x0, x1 in ((-1, px0), (px1, W)):
        d.rectangle((x0, GY, x1, H), fill=C(P['wall']))
        d.line((x0, GY, x1, GY), fill=C(P['curb_hi']))
        d.rectangle((x0, GY + 1, x1, GY + 5), fill=C(P['curb']))
        for sx in range(x0 + 7, x1, 16):  # швы плитки
            d.line((sx, GY + 1, sx - 1, GY + 5), fill=C(P['pave']))
        d.line((x0, GY + 6, x1, GY + 6), fill=C(P['pave_sh']))
        # кирпич подпорной стенки: ряды со сдвигом, низ темнеет ступенями
        for r, y in enumerate(range(GY + 7, H, 6)):
            off = 0 if r % 2 else 6
            d.line((x0, y + 5, x1, y + 5), fill=C(P['wall_dk']))
            for bx in range(x0 - 12 + off, x1, 12):
                d.line((bx, y, bx, y + 4), fill=C(P['wall_dk']))
                if r < 3 and rnd.random() < .35: d.line((bx + 1, y, bx + 6, y), fill=C(P['wall_hi']))
        # низ стенки уходит в тень ступенями: шахматка на стыке, дальше сплошной цвет
        for y in range(GY + 31, H):
            col = P['wall_dk'] if y < GY + 43 else P['soil']
            for x in range(max(0, x0), min(W, x1 + 1)):
                if y not in (GY + 31, GY + 43) or (x + y) % 2 == 0:
                    img.putpixel((x, y), C(col))
        for r, y in enumerate(range(GY + 31, GY + 43, 6)):  # кирпич проступает в тени
            off = 0 if r % 2 else 6
            for bx in range(x0 - 12 + off, x1, 12):
                d.line((bx, y, bx, y + 4), fill=C(P['soil']))
            d.line((x0, y + 5, x1, y + 5), fill=C(P['soil']))
        for x in (x0, x1):  # кромки ямы
            if 0 < x < W - 1:
                d.line((x, GY, x, H), fill=C(P['ink']))
        for _ in range((x1 - x0) // 22):  # травинки у бордюра
            gx = rnd.randint(max(x0, 0) + 2, min(x1, W) - 3)
            d.point([(gx, GY - 1), (gx + 1, GY - 2), (gx + 2, GY - 1)], fill=C('#c99a52'))
    pit_gap(img, px0, px1, rnd)
    return img

PIT_BANDS = [(0, '#4a2238'), (14, '#3a1a30'), (30, '#2a1226'), (44, '#1c0b1a')]

def pit_gap(img, px0, px1, rnd):
    """Провал: тёмные полосы вниз, обломанный кирпич по краям, светлые губы бордюра."""
    d = ImageDraw.Draw(img)
    for y in range(GY, H):
        col = [c for y0, c in PIT_BANDS if y - GY >= y0][-1]
        d.line((px0 + 1, y, px1 - 1, y), fill=C(col))
    # обломанные края: каждый ряд кирпича торчит в яму на разную глубину
    for side, x, sgn in (('L', px0, 1), ('R', px1, -1)):
        for r, y in enumerate(range(GY + 7, H - 4, 6)):
            k = [5, 2, 7, 0, 4, 1, 6, 0, 3][r % 9] if side == 'L' else [2, 6, 3, 0, 5, 1, 4, 7, 0][r % 9]
            if not k: continue
            xa, xb = (x + 1, x + k) if sgn > 0 else (x - k, x - 1)
            dark = r > 3
            d.rectangle((xa, y, xb, y + 4), fill=C(P['wall_dk'] if dark else P['wall']))
            d.line((xa, y, xb, y), fill=C(P['wall_hi'] if not dark else P['wall']))
            d.line((xa, y + 5, xb, y + 5), fill=C(P['ink']))
            d.line((xb if sgn > 0 else xa, y, xb if sgn > 0 else xa, y + 4), fill=C(P['ink']))
        # грань стены: к солнцу (левый берег) светлее, правый — в тени
        d.line((x, GY + 7, x, H), fill=C(P['wall_hi'] if sgn > 0 else P['near_dk']))
    # губы бордюра: плитка свисает над ямой на 3 px, верх подсвечен, контур — только со стороны ямы
    for x, sgn in ((px0, 1), (px1, -1)):
        xa, xb = (x - 1, x + 3) if sgn > 0 else (x - 3, x + 1)
        d.rectangle((xa, GY, xb, GY + 5), fill=C(P['curb']))
        d.line((xa, GY, xb, GY), fill=C(P['curb_hi']))
        tip = xb + 1 if sgn > 0 else xa - 1
        d.line((tip, GY, tip, GY + 6), fill=C(P['ink']))
        d.line((xa if sgn > 0 else tip, GY + 6, tip if sgn > 0 else xb, GY + 6), fill=C(P['ink']))
        d.point((tip, GY), fill=C(P['curb']))
    # травинки на губах и камешки, сорвавшиеся вниз
    for gx in (px0 - 1, px1 - 2):
        d.point([(gx, GY - 1), (gx + 1, GY - 2), (gx + 2, GY - 1), (gx + 3, GY - 2)], fill=C('#c99a52'))
    for bx, by in ((px0 + 18, GY + 22), (px1 - 18, GY + 38)):
        d.rectangle((bx, by, bx + 2, by + 1), fill=C(P['wall'])); d.point((bx, by), fill=C(P['wall_hi']))

def ledge(w=48):
    """Уступ: главный игровой объект — светлая верхняя кромка, тёмный фасад, кронштейны."""
    img = Image.new('RGBA', (w + 2, 18)); d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w + 1, 10), fill=C(P['ink']))                 # общий тёплый контур
    d.line((1, 1, w, 1), fill=C('#fff0c4'))                         # блик кромки
    d.rectangle((1, 2, w, 3), fill=C(P['curb_hi']))
    d.line((1, 4, w, 4), fill=C(P['curb']))
    d.line((1, 5, w, 5), fill=C(P['pave_sh']))
    d.rectangle((1, 6, w, 9), fill=C(P['wall_dk']))                 # фасад в тени
    for bx in range(6, w, 10): d.line((bx, 6, bx, 9), fill=C(P['near_dk']))
    d.line((1, 6, w, 6), fill=C(P['wall']))
    for bx in (5, w - 9):  # кронштейны
        d.polygon([(bx, 11), (bx + 6, 11), (bx + 4, 16), (bx + 2, 16)], fill=C(P['near_dk']))
        d.line((bx + 6, 11, bx + 4, 16), fill=C(P['near_rim']))
        d.line((bx - 1, 11, bx + 1, 17), fill=C(P['ink'])); d.line((bx + 7, 11, bx + 5, 17), fill=C(P['ink']))
        d.line((bx + 2, 17, bx + 4, 17), fill=C(P['ink']))
    d.rectangle((w - 8, -1, w - 4, 0), fill=C('#b8604a'))
    return img

def ledge_shadow(img, x0, y, w):
    """Падающая тень 1-2 px под плитой: затемнение того, что за ней."""
    a = np.array(img)
    a[y, x0:x0 + w, :3] = (a[y, x0:x0 + w, :3] * .62).astype(np.uint8)
    a[y + 1, x0 + 3:x0 + w - 3:2, :3] = (a[y + 1, x0 + 3:x0 + w - 3:2, :3] * .75).astype(np.uint8)
    img.paste(Image.fromarray(a, 'RGBA'))

def flowers(d, x, y):
    for dx, dy, c in [(0, -3, '#7ea04a'), (2, -4, '#7ea04a'), (4, -3, '#7ea04a'), (1, -5, '#ff8aa0'),
                      (4, -6, '#ffd36a'), (2, -2, '#5e8040')]:
        d.point((x + dx, y + dy), fill=C(c))
    d.rectangle((x, y - 1, x + 4, y + 1), fill=C('#b8604a')); d.line((x, y - 1, x + 4, y - 1), fill=C('#e08a64'))

def lamp(d, x):
    iron, rim = C('#3a1a30'), C(P['near_rim'])
    d.rectangle((x - 3, GY - 6, x + 3, GY - 1), fill=iron); d.line((x + 3, GY - 6, x + 3, GY - 1), fill=rim)
    d.rectangle((x - 2, GY - 9, x + 2, GY - 6), fill=iron)
    d.rectangle((x - 1, GY - 72, x, GY - 9), fill=iron); d.line((x + 1, GY - 72, x + 1, GY - 9), fill=rim)
    d.rectangle((x - 2, GY - 40, x + 2, GY - 38), fill=iron)
    d.rectangle((x - 2, GY - 74, x + 2, GY - 72), fill=iron)
    ly = GY - 86  # фонарь
    d.polygon([(x - 5, ly), (x + 5, ly), (x + 3, ly + 11), (x - 3, ly + 11)], fill=iron)
    d.polygon([(x - 4, ly + 1), (x + 4, ly + 1), (x + 2, ly + 10), (x - 2, ly + 10)], fill=C('#ffe7a0'))
    d.line((x, ly + 1, x, ly + 10), fill=C('#ffc878')); d.point((x - 3, ly + 2), fill=C('#ffffff'))
    d.polygon([(x - 6, ly), (x, ly - 5), (x + 6, ly)], fill=iron); d.line((x, ly - 5, x + 6, ly), fill=rim)
    d.point((x, ly - 7), fill=iron); d.point((x, ly - 6), fill=iron)

def lamp_glow(img, x):
    a = np.array(img); cx, cy = x, GY - 81
    for y in range(cy - 14, cy + 15):
        for xx in range(cx - 14, cx + 15):
            dd = ((xx - cx) ** 2 + (y - cy) ** 2) ** .5
            if dd < 14 and BAYER4[y % 4, xx % 4] < (14 - dd) / 14 * .5:
                a[y, xx, :3] = (a[y, xx, :3] * .45 + np.array(C('#ffe7a0'))[:3] * .55).astype(np.uint8)
    img.paste(Image.fromarray(a, 'RGBA'))

def heart():
    m = Map(15, 14)
    m.ell((1, 1, 7, 7), 1); m.ell((7, 1, 13, 7), 1); m.poly([(1, 5), (13, 5), (7, 12)], 1)
    a = m.a; out = np.zeros((14, 15, 4), np.uint8)
    out[a > 0] = C('#ff4d6d')
    out[(neighbors_empty(a, 0, 1) | neighbors_empty(a, 1, 0)) & (a > 0)] = C('#c42a52')
    out[outline_mask(a, diag=False)] = C('#5a0f2c')
    for x, y, c in [(3, 3, '#ffc2cc'), (4, 3, '#ffc2cc'), (3, 4, '#ffc2cc'), (3, 2, '#ffffff'), (9, 3, '#ff8aa0')]:
        out[y, x] = C(c)
    return Image.fromarray(out, 'RGBA')

def sparkle(d, x, y, c='#fff3c4', big=True):
    d.point((x, y), fill=C(c))
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((2, 0), (-2, 0), (0, 2), (0, -2)) if big else ()):
        d.point((x + dx, y + dy), fill=C(c if abs(dx) + abs(dy) == 1 else '#ffd27a'))
