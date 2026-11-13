"""A3: пол трёх тем. Лист 80x16 = пять тайлов 16x16: левый край, середина,
правый край, толща, второй вариант середины (чередуется, чтобы не было «обоев»). Тайлы бесшовные: рисуются прямо пикселями (без render,
иначе контур лёг бы на стык), но по тем же правилам — свет сверху-слева,
тень дизерингом, тёмная кромка вместо чёрной.
"""
import random
from PIL import Image
from px import C

T = 16
THEMES = {
    'street': dict(top=('#35422e', '#4a5a3a', '#5e6e46'), curb=('#6a5a82', '#a89fd0'),
                   body=('#1c1830', '#2a2440', '#3a3458'), out='#1a1426', grass=3),
    'room':   dict(top=('#5a4a52', '#2a1a12', '#2a1a12'), curb=('#9a6e54', '#e8cda0'),
                   body=('#6e4c3a', '#9a6e54', '#b48a66'), out='#2a1a12', grass=0),
    'road':   dict(top=('#35422e', '#3f5036', '#5e6e46'), curb=('#6a5a5a', '#ffe6b0'),
                   body=('#3a2c2e', '#4a3a3a', '#5e4a46'), out='#1a1426', grass=4),
}

def _body(img, ox, th, y0, rnd, theme, fade=True, crack=False):
    dark, base, light = (C(c) for c in th['body'])
    for y in range(y0, T):
        for x in range(T):
            col = base
            if fade and (y >= T - 3 and (x + y) % 2 == 0 or y >= T - 2):
                col = dark                        # толща темнеет книзу дизерингом
            img.putpixel((ox + x, y), col)
    if theme == 'room':                           # доски: шов каждые 8 px, гвоздики
        for y in range(y0, T):
            img.putpixel((ox + 7, y), dark); img.putpixel((ox + 15, y), dark)
        nail = C('#6e4c3a')
        for x, y in ((3, 6), (11, 12)) if not crack else ((3, 12), (11, 6)):
            img.putpixel((ox + x, y), nail)
        if crack:                                 # стык досок со сдвигом
            for x in range(8, 15):
                img.putpixel((ox + x, 9), dark)
        return
    for _ in range(3):                            # камешки / зерно асфальта
        x, y = rnd.randrange(1, T - 2), rnd.randrange(y0 + 1, T - 3)
        img.putpixel((ox + x, y), light); img.putpixel((ox + x + 1, y + 1), dark)
    if theme == 'street' and crack:               # трещина
        x, y = rnd.randrange(3, T - 4), y0 + 3
        for i in range(4):
            img.putpixel((ox + x + (i % 2), y + i), C('#1a1426'))

def _surface(img, ox, th, theme, rnd):
    """Верхние 4 px: трава/плинтус, светлая кромка бордюра."""
    tdark, tbase, tlight = (C(c) for c in th['top'])
    cdark, clight = (C(c) for c in th['curb'])
    if theme == 'room':                           # плинтус: тёмная линия, светлая кромка доски
        for x in range(T):
            img.putpixel((ox + x, 0), tdark); img.putpixel((ox + x, 1), tbase)
            img.putpixel((ox + x, 2), clight); img.putpixel((ox + x, 3), cdark)
        return 4
    for x in range(T):
        h = 1 + (rnd.random() < th['grass'] / 8)  # неровная кромка травы
        for y in range(0, 2):
            img.putpixel((ox + x, y), tbase if y < h else tdark)
        img.putpixel((ox + x, 0), tlight if (x * 7 + ox) % 5 == 0 else tbase)
        img.putpixel((ox + x, 2), clight)
        img.putpixel((ox + x, 3), cdark)
    return 4

def _edge(img, ox, side, th):
    """Торец: контур по внешнему краю, срезанный угол сверху."""
    out = C(th['out'])
    x = ox if side == 'L' else ox + T - 1
    for y in range(T):
        img.putpixel((x, y), out)
    corner = (ox, ox + 1) if side == 'L' else (ox + T - 1, ox + T - 2)
    img.putpixel((corner[0], 0), (0, 0, 0, 0)); img.putpixel((corner[0], 1), out)
    img.putpixel((corner[1], 0), out)

def tiles(theme):
    th = THEMES[theme]
    img = Image.new('RGBA', (T * 5, T), (0, 0, 0, 0))
    for i in (0, 1, 2, 4):
        rnd = random.Random(f'{theme}{i}')
        _body(img, i * T, th, 0, rnd, theme, crack=i == 4)
        _surface(img, i * T, th, theme, rnd)
    _body(img, 3 * T, th, 0, random.Random(theme + 'fill'), theme, fade=False)
    _edge(img, 0, 'L', th)
    _edge(img, 2 * T, 'R', th)
    return img

def build():
    return {f'ground_{t}': tiles(t) for t in THEMES}
