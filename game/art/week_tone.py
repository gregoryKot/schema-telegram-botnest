"""Свет «Недели»: фон пишется в полном цвете (цвет предмета × карта света), затем сводится
к палитре упорядоченным дизером. Так у всех фонов один свет: тёплый на свету, холодный в тени."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from tile import BAYER4

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

class Scene:
    """Холст сцены: d — рисование цветом предметов; light — карта света 0..1 (0.5 — рассеянный)."""
    def __init__(self, w, h, base='#000000', ambient=0.5):
        self.w, self.h = w, h
        self.img = Image.new('RGB', (w, h), rgb(base)); self.d = ImageDraw.Draw(self.img)
        self.light = np.full((h, w), ambient, np.float32)
        self.hole = Image.new('L', (w, h), 0); self.hd = ImageDraw.Draw(self.hole)   # прозрачные проёмы
        self.sun = Image.new('L', (w, h), 0)                                         # куда падает солнце (в сбое — розовый отсвет)

    def rect(self, box, col): self.d.rectangle(box, fill=rgb(col))
    def poly(self, pts, col): self.d.polygon(pts, fill=rgb(col))
    def line(self, pts, col, w=1): self.d.line(pts, fill=rgb(col), width=w)
    def ell(self, box, col): self.d.ellipse(box, fill=rgb(col))

    def lit(self, shape, amount, blur=0.0, kind='poly', sun=False):
        """Добавить (или убрать, amount < 0) свет в области; blur — мягкость края в px."""
        m = Image.new('L', (self.w, self.h), 0); d = ImageDraw.Draw(m)
        getattr(d, {'poly': 'polygon', 'rect': 'rectangle', 'ell': 'ellipse'}[kind])(shape, fill=255)
        if blur:
            m = m.filter(ImageFilter.GaussianBlur(blur))
        self.light += np.asarray(m, np.float32) / 255 * amount
        if sun:
            self.sun = Image.fromarray(np.maximum(np.asarray(self.sun), np.asarray(m)))

    def grade(self, y0, y1, a0, a1):
        """Вертикальный градиент света между строками."""
        t = np.clip((np.arange(self.h) - y0) / max(1, y1 - y0), 0, 1)
        self.light += (a0 + (a1 - a0) * t)[:, None].astype(np.float32)

    def render(self, shadow='#8a93c8', sun='#fff3d6', colors=56, amp=6, post=None):
        """Тень красит в shadow, свет — в sun; post(arr) — цветокор до палитры (сбой)."""
        a = np.asarray(self.img, np.float32)
        L = np.clip(self.light, 0, 1.25)[..., None]
        lo, hi = np.array(rgb(shadow), np.float32) / 255, np.array(rgb(sun), np.float32) / 255
        tint = lo * 0.72 + (hi * 1.12 - lo * 0.72) * np.clip(L, 0, 1) + np.clip(L - 1, 0, 1) * 0.5
        out = np.clip(a * tint, 0, 255)
        if post:
            out = np.clip(post(out), 0, 255)
        img = to_palette(out, colors, amp)
        img.putalpha(Image.eval(self.hole, lambda v: 0 if v else 255))
        return img

def pick_palette(arr, n):
    """Палитра k-средних по уникальным цветам: редкий акцент (зелень, стикер) не тонет в большой стене."""
    cols, cnt = np.unique(arr.reshape(-1, 3).astype(np.uint8), axis=0, return_counts=True)
    if len(cols) <= n:
        return cols
    pts, wt = cols.astype(np.float32), cnt.astype(np.float32) ** 0.35
    cen = [pts[np.argmax(cnt)]]
    dist = np.full(len(pts), 1e12, np.float32)
    for _ in range(n - 1):                                      # старт: самые далёкие друг от друга цвета
        dist = np.minimum(dist, ((pts - cen[-1]) ** 2).sum(1))
        cen.append(pts[np.argmax(dist * wt)])
    cen = np.array(cen)
    for _ in range(10):
        own = np.argmin(((pts[:, None] - cen[None]) ** 2).sum(2), 1)
        for k in range(n):
            m = own == k
            if m.any():
                cen[k] = (pts[m] * wt[m, None]).sum(0) / wt[m].sum()
    return np.round(cen).astype(np.uint8)

def to_palette(arr, colors=56, amp=6):
    """Свести к палитре: палитра берётся с чистой картинки, дизер по Байеру — только на переходах."""
    h, w, _ = arr.shape
    pal = Image.new('P', (1, 1)); pal.putpalette([int(v) for v in pick_palette(arr, colors).reshape(-1)])
    b = (np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w] - 0.5) * amp
    noisy = Image.fromarray(np.clip(arr + b[..., None], 0, 255).astype(np.uint8), 'RGB')
    return noisy.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA')

def duotone(stops):
    """Цветокор по яркости: stops — цвета от тёмного к светлому. Возвращает post для render()."""
    cols = np.array([rgb(s) for s in stops], np.float32)
    def post(a):
        lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255 * (len(cols) - 1)
        i = np.clip(lum.astype(int), 0, len(cols) - 2); t = (lum - i)[..., None]
        return cols[i] * (1 - t) + cols[i + 1] * t
    return post
