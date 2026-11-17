"""Мини-конвейер эталона: карта материалов (uint8) -> RGBA, контур, кромка, дизеринг."""
import numpy as np
from PIL import Image, ImageDraw

def C(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

class Map:
    """Карта материалов с рисованием примитивами без сглаживания."""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new('L', (w, h), 0)
        self.d = ImageDraw.Draw(self.img)
    def ell(self, box, m): self.d.ellipse(box, fill=m)
    def rect(self, box, m): self.d.rectangle(box, fill=m)
    def poly(self, pts, m): self.d.polygon(pts, fill=m)
    def line(self, pts, m, w=1): self.d.line(pts, fill=m, width=w)
    def px(self, x, y, m):
        if 0 <= x < self.w and 0 <= y < self.h: self.img.putpixel((x, y), m)
    def stamp(self, rows, ox, oy, key):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in key and key[ch] is not None:
                    self.px(ox + i, oy + j, key[ch])
    @property
    def a(self): return np.array(self.img)

def neighbors_empty(a, dx, dy):
    """Маска: пиксель занят, а сосед (x+dx, y+dy) пуст."""
    h, w = a.shape
    pad = np.zeros((h + 2, w + 2), a.dtype); pad[1:-1, 1:-1] = a
    nb = pad[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
    return (a > 0) & (nb == 0)

def outline_mask(a, diag=False):
    h, w = a.shape
    pad = np.zeros((h + 2, w + 2), bool); pad[1:-1, 1:-1] = a > 0
    m = np.zeros((h, w), bool)
    dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)] + ([(1, 1), (-1, 1), (1, -1), (-1, -1)] if diag else [])
    for dx, dy in dirs:
        m |= pad[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
    return m & (a == 0)

def up(img, k): return img.resize((img.width * k, img.height * k), Image.NEAREST)

def vgrad(w, h, stops, dither=True):
    """Вертикальный градиент полосами палитры с упорядоченным дизерингом на стыках."""
    out = np.zeros((h, w, 4), np.uint8)
    cols = [np.array(C(c)) for _, c in stops]
    ys = [p for p, _ in stops]
    for y in range(h):
        t = y / (h - 1)
        k = max(i for i in range(len(ys)) if ys[i] <= t) if t >= ys[0] else 0
        k = min(k, len(ys) - 2)
        f = (t - ys[k]) / max(1e-6, ys[k + 1] - ys[k])
        f = min(1, max(0, f))
        for x in range(w):
            pick = cols[k + 1] if (dither and f > BAYER4[y % 4, x % 4]) or (not dither and f > .5) else cols[k]
            out[y, x] = pick
    return Image.fromarray(out, 'RGBA')

def dmix(a, b, f, x, y):
    """Дизер-смесь двух цветов: доля f второго цвета по матрице Байера."""
    return b if f > BAYER4[y % 4, x % 4] else a

def ell_mask(w, h, blobs):
    """Маска из эллипсов (cx, cy, rx, ry)."""
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for cx, cy, rx, ry in blobs:
        d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=1)
    return np.array(m)

def foliage(img, blobs, base, lit, dark, out=None, sun_right=True):
    """Листва кластерами: каждый шар — освещённый серп к солнцу и тень снизу, общий контур."""
    w, h = img.size
    a = np.array(img); tot = np.zeros((h, w), bool)
    sx = 2 if sun_right else -2
    for cx, cy, r in blobs:
        disk = ell_mask(w, h, [(cx, cy, r, r)]) > 0
        lit_m = disk & ~(ell_mask(w, h, [(cx - sx, cy + 2, r, r)]) > 0)
        dk_m = disk & ~(ell_mask(w, h, [(cx + sx // 2, cy - 2, r, r)]) > 0)
        a[disk] = C(base); a[dk_m] = C(dark); a[lit_m] = C(lit)
        tot |= disk
    if out:
        a[outline_mask(tot.astype(np.uint8))] = C(out)
    img.paste(Image.fromarray(a, 'RGBA'))
    return tot
