"""Небо главы 1 (показ x2, с камерой не едет), два кадра — десктоп и тач: полосы палитры с узкой
дизер-кромкой, солнце у горизонта, гряды облаков с подсветкой снизу, птицы, первые звёзды."""
import numpy as np
from PIL import Image, ImageDraw
from px import C, PAL
from tile import BAYER4

P = PAL['ch1']
BAND = ('sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5', 'sky6', 'sky7', 'sky8')

def bands(w, h, ys, edge=0.35):
    """Жёсткие полосы, дизер только в последней доле `edge` каждой полосы."""
    out = np.zeros((h, w, 4), np.uint8)
    ys = list(ys) + [h + 99]; cols = [np.array(C(P[c])) for c in BAND] + [np.array(C(P['sky8']))]
    for y in range(h):
        k = max(i for i in range(len(BAND)) if ys[i] <= y)
        g = max(0.0, ((y - ys[k]) / (ys[k + 1] - ys[k]) - (1 - edge)) / edge)
        out[y] = np.where((g > BAYER4[y % 4, np.arange(w) % 4])[:, None], cols[k + 1], cols[k])
    return out

def sun_disc(a, cx, cy, r):
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = ((xs - cx) ** 2 + (ys - cy) ** 2) ** .5
    halo = (d <= r + 3) | ((d <= r + 8) & ((xs + ys) % 2 == 0)) | ((d <= r + 15) & (xs % 2 == 0) & (ys % 2 == 0))
    a[halo] = C(P['sun_halo'])
    a[d <= r] = C(P['sun'])

def cloud(a, sun_x, x, y, parts):
    """Гряда: капсулы одной маской; верх лиловый, низ подсвечен, у солнца — горячая кромка."""
    h, w = a.shape[:2]
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for dx, dy, l, t in parts:
        d.rounded_rectangle((x + dx, y + dy, x + dx + l, y + dy + t), radius=t // 2, fill=1)
    b = np.array(m) > 0
    up = np.zeros_like(b); up[1:] = b[1:] & ~b[:-1]; up[0] = b[0]
    dn = np.zeros_like(b); dn[:-1] = b[:-1] & ~b[1:]
    dn2 = np.zeros_like(b); dn2[:-1] = b[:-1] & dn[1:]
    hot = np.abs(np.arange(w)[None, :] - sun_x) < 70
    a[b] = C(P['cl_mid']); a[up] = C(P['cl_top'])
    a[dn2 & hot] = C(P['cl_lit']); a[dn] = C(P['cl_lit']); a[dn & hot] = C(P['cl_hot'])

BIG = [(36, -6, 54, 6), (84, -10, 28, 5), (0, 0, 150, 7), (60, 5, 110, 4), (12, 7, 30, 2)]
RIDGE = [(18, -4, 26, 4), (0, 0, 74, 5), (40, 3, 50, 3)]
# Кадр 480x223 (десктоп): земля на строке 215, низ — запас под кромку пола.
DESK = dict(size=(480, 223), sun=(346, 160, 20), ys=(0, 26, 52, 78, 102, 124, 142, 158, 176), clouds=[
    (-30, 40, [(40, -7, 46, 6), (80, -4, 40, 5), (0, 0, 132, 7), (100, 4, 70, 4), (-6, 6, 50, 3)]),
    (128, 62, RIDGE), (238, 96, BIG), (18, 114, [(0, 0, 58, 3), (24, -2, 20, 3)]),
    (404, 126, [(8, -3, 28, 4), (0, 0, 86, 4)]), (294, 140, [(0, 0, 34, 2)]), (96, 134, [(0, 0, 44, 2), (12, -2, 22, 2)]),
], stars=[(150, 10, 1), (236, 22, 0), (92, 28, 0), (318, 8, 0), (420, 30, 1), (380, 16, 0), (40, 14, 0)],
    birds=[(196, 74, 1), (206, 70, 0), (214, 76, 1), (262, 62, 0)])
# Тач-кадр 320x133: над землёй всего 125 строк — те же полосы плотнее, чтобы наверху
# остался лиловый вечер (сердца HUD читаются), а солнце стояло над тем же горизонтом.
TOUCH = dict(size=(320, 133), sun=(230, 70, 20), ys=(0, 7, 15, 24, 33, 43, 52, 68, 86), clouds=[
    (150, 30, BIG), (58, 17, RIDGE), (-24, 44, [(0, 0, 62, 4), (20, -3, 30, 4), (34, 3, 40, 2)]),
    (8, 62, [(0, 0, 58, 3), (24, -2, 20, 3)]), (268, 48, [(8, -3, 28, 4), (0, 0, 60, 4)]), (176, 50, [(0, 0, 34, 2)]),
], stars=[(70, 3, 0), (150, 4, 1), (212, 9, 0), (262, 5, 0)], birds=[(112, 34, 1), (122, 30, 0), (130, 36, 1)])

def sky(size, sun, ys, clouds, stars, birds):
    a = bands(*size, ys)
    sun_disc(a, *sun)
    for x, y, parts in clouds:
        cloud(a, sun[0], x, y, parts)
    img = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(img)
    for x, y, flap in birds:
        dy = (0, -1, 0, -1, 0) if flap else (-1, 0, 0, 0, -1)
        d.point([(x + i, y + v) for i, v in enumerate(dy)], fill=C('#6a3a6e'))
    for x, y, big in stars:
        if big:
            d.point([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)], fill=C('#8a78c0'))
        d.point((x, y), fill=C('#e8d8ff'))
    return img

def build():
    return {'bg_street_sky': sky(**DESK), 'bg_street_sky_touch': sky(**TOUCH)}
