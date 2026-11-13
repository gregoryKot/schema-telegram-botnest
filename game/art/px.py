"""Общий конвейер пиксель-арта игры: маска материалов -> один стиль на всё.

Каждый ассет рисуется геометрией без сглаживания в карту материалов (id 1..255),
затем render() красит её одинаково для всех: свет сверху-слева (кромка light),
тень снизу-справа (dark + полоса дизеринга), контур 1 px тёмным оттенком
объекта (не чёрным). Детали (глаза, окна, трещины) — ink поверх.
Палитра — раздел 2 docs/GAME_ART_BRIEF.md.
"""
import numpy as np
from PIL import Image, ImageDraw

def C(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

# Контуры: холодный и тёплый (бриф, «Линии»)
OUT_COOL, OUT_WARM, OUT_CAT = '#1a1426', '#2a1a12', '#0e0b16'

class Mat:
    """ramp = (dark, base, light); shade — толщина тени снизу-справа в px."""
    def __init__(self, dark, base, light, out=OUT_COOL, shade=1, rim=True, z=0, dither=True):
        self.ramp = (C(dark), C(base), C(light))
        self.out, self.shade, self.rim, self.z, self.dither = C(out), shade, rim, z, dither

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.m = Image.new('L', (w, h), 0)
        self.d = ImageDraw.Draw(self.m)
        self.ink = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.i = ImageDraw.Draw(self.ink)
        self.under = Image.new('RGBA', (w, h), (0, 0, 0, 0))   # ореолы света — под объектом
        self.u = ImageDraw.Draw(self.under)

    # --- геометрия в карту материалов ---
    def poly(self, pts, mat): self.d.polygon(pts, fill=mat)
    def ell(self, box, mat): self.d.ellipse(box, fill=mat)
    def rect(self, box, mat): self.d.rectangle(box, fill=mat)
    def line(self, pts, mat, w=1): self.d.line(pts, fill=mat, width=w)
    def clear(self, box): self.d.rectangle(box, fill=0)

    # --- детали поверх готового рендера ---
    def dot(self, x, y, col): self.i.point((x, y), fill=C(col))
    def iline(self, pts, col, w=1): self.i.line(pts, fill=C(col), width=w)
    def irect(self, box, col): self.i.rectangle(box, fill=C(col))
    def iell(self, box, col): self.i.ellipse(box, fill=C(col))

    def uell(self, box, col): self.u.ellipse(box, fill=C(col))

    def render(self, mats, outline=True):
        img = self.under.copy()
        img.alpha_composite(render(np.array(self.m), mats, self.ink, outline))
        return img

def _run(a, x, y, dx, dy):
    """Сколько пикселей того же материала подряд в направлении (dx, dy)."""
    h, w = a.shape; v = a[y, x]; n = 0
    while 0 <= x + dx < w and 0 <= y + dy < h and a[y + dy, x + dx] == v:
        x += dx; y += dy; n += 1
    return n

def render(a, mats, ink=None, outline=True):
    h, w = a.shape
    out = np.zeros((h, w, 4), np.uint8)
    get = lambda x, y: a[y, x] if 0 <= x < w and 0 <= y < h else 0
    for y in range(h):
        for x in range(w):
            v = a[y, x]
            if not v:
                continue
            m = mats[v]; dark, base, light = m.ramp
            col = base
            dist = min(_run(a, x, y, 0, 1), _run(a, x, y, 1, 0))
            if m.shade and dist < m.shade:
                col = dark
            elif m.shade and m.dither and dist == m.shade and (x + y) % 2 == 0:
                col = dark
            if m.rim and (get(x, y - 1) != v or get(x - 1, y) != v):
                col = light
            # край переднего объекта поверх заднего — внутренний контур
            for nx, ny in ((x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)):
                nv = get(nx, ny)
                if nv and nv != v and mats[nv].z < m.z:
                    col = m.out
                    break
            out[y, x] = col
    if outline:
        for y in range(h):
            for x in range(w):
                if a[y, x]:
                    continue
                for nx, ny in ((x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)):
                    nv = get(nx, ny)
                    if nv:
                        out[y, x] = mats[nv].out
                        break
    img = Image.fromarray(out, 'RGBA')
    if ink is not None:
        img.alpha_composite(ink)
    return img

def strip(frames):
    """Кадры одного размера в одну строку слева направо, без полей."""
    fw, fh = frames[0].size
    s = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * fw, 0))
    return s

def check(img, name, limit=32):
    """Требования брифа (раздел 3): не больше limit цветов, альфа только 0/255."""
    cols = img.getcolors(1 << 16) or []
    opaque = {c for _, c in cols if c[3]}
    assert len(opaque) <= limit, f'{name}: {len(opaque)} цветов > {limit}'
    assert all(c[3] in (0, 255) for _, c in cols), f'{name}: полупрозрачные пиксели'
    return opaque

def save(img, path, limit=32):
    opaque = check(img, path, limit)
    # индексная PNG с точной палитрой: индекс 0 — прозрачный
    idx = {c: i + 1 for i, c in enumerate(sorted(opaque))}
    a = np.array(img)
    p = np.zeros(a.shape[:2], np.uint8)
    for c, i in idx.items():
        p[np.all(a == c, axis=2)] = i
    q = Image.fromarray(p, 'P')
    pal = [0, 0, 0] + [v for c in sorted(opaque) for v in c[:3]]
    q.putpalette(pal)
    q.save(path, optimize=True, transparency=0)
