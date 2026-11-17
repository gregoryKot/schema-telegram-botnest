"""Небо главы 1: полосы палитры с узкой дизер-кромкой, солнце у горизонта, облака, птицы."""
import numpy as np
from PIL import Image, ImageDraw
from pix import C, BAYER4
from pal import CH1 as P

W, H = 480, 270
SUN = (346, 160, 20)

def bands(w, h, stops, edge=0.35):
    """Жёсткие полосы, дизер только в последней доле `edge` каждой полосы."""
    out = np.zeros((h, w, 4), np.uint8)
    ys = [y for y, _ in stops]; cols = [np.array(C(c)) for _, c in stops]
    for y in range(h):
        k = max(i for i in range(len(ys) - 1) if ys[i] <= y) if y >= ys[0] else 0
        f = (y - ys[k]) / max(1, ys[k + 1] - ys[k])
        g = max(0.0, (f - (1 - edge)) / edge)
        for x in range(w):
            out[y, x] = cols[k + 1] if g > BAYER4[y % 4, x % 4] else cols[k]
    return Image.fromarray(out, 'RGBA')

def sky():
    stops = [(0, P['sky0']), (26, P['sky1']), (52, P['sky2']), (78, P['sky3']), (102, P['sky4']),
             (124, P['sky5']), (142, P['sky6']), (158, P['sky7']), (176, P['sky8']), (270, P['sky8'])]
    img = bands(W, H, stops)
    sun(img)
    clouds(img)
    birds(img)
    for x, y, big in [(150, 10, 1), (236, 22, 0), (92, 28, 0), (318, 8, 0), (420, 30, 1), (380, 16, 0), (40, 14, 0)]:
        img.putpixel((x, y), C('#e8d8ff'))
        if big:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): img.putpixel((x + dx, y + dy), C('#8a78c0'))
    return img

def sun(img):
    cx, cy, r = SUN
    a = np.array(img)
    for y in range(H):
        for x in range(W):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
            if d <= r:
                a[y, x] = C(P['sun'])
            elif d <= r + 3:
                a[y, x] = C(P['sun_halo'])
            elif d <= r + 8 and (x + y) % 2 == 0:
                a[y, x] = C(P['sun_halo'])
            elif d <= r + 15 and (x % 2 == 0 and y % 2 == 0):
                a[y, x] = C(P['sun_halo'])
    img.paste(Image.fromarray(a, 'RGBA'))

def cloud(img, x, y, parts):
    """Гряда: капсулы одной маской; верх лиловый, низ подсвечен, у солнца — горячая кромка."""
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for dx, dy, l, t in parts:
        d.rounded_rectangle((x + dx, y + dy, x + dx + l, y + dy + t), radius=t // 2, fill=1)
    a = np.array(m) > 0; out = np.array(img)
    up_ = np.zeros_like(a); up_[1:] = a[1:] & ~a[:-1]; up_[0] = a[0]
    dn = np.zeros_like(a); dn[:-1] = a[:-1] & ~a[1:]
    dn2 = np.zeros_like(a); dn2[:-1] = a[:-1] & dn[1:]
    xs = np.arange(W)[None, :].repeat(H, 0)
    hot = np.abs(xs - SUN[0]) < 70
    out[a] = C(P['cl_mid']); out[up_] = C(P['cl_top'])
    out[dn2 & hot] = C(P['cl_lit']); out[dn] = C(P['cl_lit']); out[dn & hot] = C(P['cl_hot'])
    img.paste(Image.fromarray(out, 'RGBA'))

def clouds(img):
    cloud(img, -30, 40, [(40, -7, 46, 6), (80, -4, 40, 5), (0, 0, 132, 7), (100, 4, 70, 4), (-6, 6, 50, 3)])
    cloud(img, 128, 62, [(18, -4, 26, 4), (0, 0, 74, 5), (40, 3, 50, 3)])
    cloud(img, 238, 96, [(36, -6, 54, 6), (84, -10, 28, 5), (0, 0, 150, 7), (60, 5, 110, 4), (12, 7, 30, 2)])
    cloud(img, 18, 114, [(0, 0, 58, 3), (24, -2, 20, 3)])
    cloud(img, 404, 126, [(8, -3, 28, 4), (0, 0, 86, 4)])
    cloud(img, 294, 140, [(0, 0, 34, 2)])

def birds(img):
    d = ImageDraw.Draw(img); ink = C('#6a3a6e')
    for x, y, up in [(196, 74, 1), (206, 70, 0), (214, 76, 1), (262, 62, 0)]:
        if up:
            d.point([(x, y), (x + 1, y - 1), (x + 2, y), (x + 3, y - 1), (x + 4, y)], fill=ink)
        else:
            d.point([(x, y - 1), (x + 1, y), (x + 2, y), (x + 3, y), (x + 4, y - 1)], fill=ink)
