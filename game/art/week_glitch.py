"""Сбой «Недели»: мир тот же, но выгнут и порван. Один кислотный цвет ACID на приглушённой палитре.
Всё — целочисленные сдвиги пикселей: сбой остаётся пиксель-артом, без размытия и полутонов."""
import math
import random
import numpy as np
from PIL import Image, ImageDraw
from px import C
from week_office import ACID, W

def lift(x):
    """На сколько px пол поднят в колонке x: коридор встаёт горбом к двери и идёт волной."""
    t = min(1.0, max(0.0, (x - 150) / 300))
    return round(46 * t * t * (3 - 2 * t) + 7 * t * math.sin(x / 13))

def warp(img, top=30):
    """Выгиб: колонка x уезжает вверх на lift(x); потолок стоит, стена сжимается к нему."""
    a = np.array(img); h = a.shape[0]; out = a.copy()
    ys = np.arange(h)
    for x in range(a.shape[1]):
        dy = lift(x)
        wgt = np.clip((ys - top) / 90, 0, 1)                   # у потолка сдвига нет
        src = np.clip(ys + np.round(dy * wgt).astype(int), 0, h - 1)
        out[:, x] = a[src, x]
    return Image.fromarray(out, 'RGBA')

def tears(img, seed=7, n=26):
    """Разрывы: полосы строк съезжают вбок, по кромке — кислотные штрихи; гуще к двери."""
    rnd = random.Random(seed); a = np.array(img); h, w = a.shape[:2]
    for _ in range(n):
        y, hh = rnd.randrange(24, h - 8), rnd.choice((1, 1, 2, 3))
        x0 = rnd.randrange(170, w - 40); dx = rnd.choice((-12, -7, -4, 4, 6, 10))
        a[y:y + hh, x0:] = np.roll(a[y:y + hh, x0:], dx, axis=1)
    img = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(img)
    for _ in range(150):
        x = int(W - 1 - abs(rnd.gauss(0, 120)))
        if x < 150:
            continue
        y, ln = rnd.randrange(20, h - 6), rnd.choice((3, 5, 8, 12, 18))
        d.line((x, y, x + ln, y), fill=C(ACID))
    return img

def bubble(w=30, h=16, tail=True):
    """Уведомление: кислотный пузырь, строки текста — светлые полоски (букв на арте нет)."""
    img = Image.new('RGBA', (w + 2, h + 7), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w + 1, h + 1), 4, fill=C('#3e3c3a'))
    d.rounded_rectangle((1, 1, w, h), 3, fill=C(ACID))
    if tail:
        d.polygon([(6, h + 1), (12, h + 1), (5, h + 6)], fill=C('#3e3c3a')); d.polygon([(7, h), (10, h), (6, h + 4)], fill=C(ACID))
    for i, y in enumerate(range(5, h - 2, 4)):
        d.line((5, y, w - 5 - (i * 7) % 9, y), fill=C('#f4f1ea'))
    d.rectangle((w - 3, 0, w + 1, 4), fill=C('#f4f1ea'), outline=C('#3e3c3a'))                  # непрочитанное
    return img
