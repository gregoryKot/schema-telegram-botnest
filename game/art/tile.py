"""Общее для фонов главы: координаты эталона (кадр 480x270, земля на GY), бесшовная
склейка по горизонтали, дизер по Байеру, листва кластерами, дымка у земли."""
import numpy as np
from PIL import Image, ImageDraw
from px import C, outline_mask

GY, FRAME_H = 215, 270
BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def layer(w):
    """Холст на два периода: рисуем в [0, w), вылет вправо заворачивается в начало."""
    img = Image.new('RGBA', (w * 2, FRAME_H), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def wrap(img, w, h):
    """Период w, нижние h строк над землёй: правый вылет ложится поверх начала."""
    out = img.crop((0, GY - h, w, GY))
    out.alpha_composite(img.crop((w, GY - h, 2 * w, GY)))
    return out

def rim_box(d, x0, y0, x1, y1, base, rim, top=True):
    """Коробка против солнца: свет неба по верху, солнце — по правой грани."""
    d.rectangle((x0, y0, x1, y1), fill=C(base))
    if top:
        d.line((x0, y0, x1, y0), fill=C(rim))
    d.line((x1, y0, x1, y1), fill=C(rim))

def _disks(w, h, blobs):
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for cx, cy, r in blobs:
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=1)
    return np.array(m) > 0

def foliage(img, blobs, base, lit, dark, out=None):
    """Каждый шар — освещённый серп к солнцу (справа сверху) и тень снизу слева; общий контур."""
    w, h = img.size
    a = np.array(img); tot = np.zeros((h, w), bool)
    for cx, cy, r in blobs:
        disk = _disks(w, h, [(cx, cy, r)])
        a[disk] = C(base)
        a[disk & ~_disks(w, h, [(cx + 1, cy - 2, r)])] = C(dark)
        a[disk & ~_disks(w, h, [(cx - 2, cy + 2, r)])] = C(lit)
        tot |= disk
    if out:
        a[outline_mask(tot.astype(np.uint8)) & (np.arange(h)[:, None] < GY)] = C(out)
    img.paste(Image.fromarray(a, 'RGBA'))

def haze(img, y0, col, steps=(.22, .45, .68)):
    """Дымка у земли: ступени смешения к тёплому цвету, дизер только на стыках ступеней."""
    a = np.array(img).astype(float); c = np.array(C(col), float)[:3]
    h, w = a.shape[:2]; n = len(steps); band = (h - y0) / n
    for y in range(y0, h):
        k = min(n - 1, int((y - y0) / band)); f = (y - y0 - k * band) / band
        for x in range(w):
            if not a[y, x, 3]:
                continue
            up = k + 1 < n and f > .7 and (f - .7) / .3 > BAYER4[y % 4, x % 4]
            s = steps[k + 1 if up else k]
            a[y, x, :3] = a[y, x, :3] * (1 - s) + c * s
    return Image.fromarray(a.astype(np.uint8), 'RGBA')
