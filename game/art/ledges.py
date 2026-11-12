"""A4: карнизы-платформы 48x16 для NineSlice: торец 16 + середина 16 + торец 16.
Показываются x2 (S=2, как пол) — на экране 96x32, как в брифе.

Середина — одинаковые столбцы (без дизеринга и деталей): NineSlice её
растягивает, и одинаковые столбцы растягиваются без «мазни». Всё, что
отвечает на вопрос «на чём держится» (кронштейны, верёвки), — на торцах.
Верх (строка 1) — поверхность, по которой ходит кот.
"""
from px import Canvas, Mat, OUT_COOL, OUT_WARM

W, H = 48, 16
SLAB, LIP, BRACKET, EXTRA = 1, 2, 3, 4

def _flat(c, top, lip):
    c.rect((1, 1, W - 2, top), SLAB)
    c.rect((2, top + 1, W - 3, top + lip), LIP)

def street():
    c = Canvas(W, H)
    _flat(c, 3, 1)
    for x0 in (4, W - 12):                       # каменные консоли под торцами
        c.poly([(x0, 5), (x0 + 7, 5), (x0 + 5, 13), (x0 + 2, 13)], BRACKET)
    for x in (6, W - 7):                         # швы камня только на торцах
        c.dot(x, 2, '#2c2348')
    mats = {SLAB: Mat('#3a3458', '#5e4878', '#9a6aaa', OUT_COOL, dither=False),
            LIP: Mat('#2c2348', '#3a3458', '#5e4878', OUT_COOL, z=-1, dither=False),
            BRACKET: Mat('#2c2348', '#4a3d66', '#6a5a82', OUT_COOL, z=-2)}
    return c.render(mats)

def room():
    c = Canvas(W, H)
    _flat(c, 3, 1)
    for x0 in (3, W - 10):                       # деревянные кронштейны-угольники
        c.poly([(x0, 5), (x0 + 6, 5), (x0 + 1, 12), (x0, 12)], BRACKET)
    mats = {SLAB: Mat('#9a6e54', '#c4a07a', '#e8cda0', OUT_WARM, dither=False),
            LIP: Mat('#6e4c3a', '#7e5a44', '#9a6e54', OUT_WARM, z=-1, dither=False),
            BRACKET: Mat('#4a3228', '#6e4c3a', '#9a6e54', OUT_WARM, z=-2)}
    return c.render(mats)

def stage():
    c = Canvas(W, H)
    _flat(c, 3, 1)
    for x0 in (2, W - 6):                        # стойки лесов, верёвочная обвязка
        c.rect((x0 + 1, 5, x0 + 2, 14), BRACKET)
        c.rect((x0, 1, x0 + 3, 3), EXTRA)
    for x in (3, W - 4):                         # свисающий конец верёвки
        c.iline([(x + 1, 5), (x + 1, 8)], '#e8cda0')
    mats = {SLAB: Mat('#6e4c3a', '#8a6248', '#b48a66', OUT_WARM, dither=False),
            LIP: Mat('#4a3228', '#5a3e30', '#6e4c3a', OUT_WARM, z=-1, dither=False),
            BRACKET: Mat('#4a3228', '#5a3e30', '#7e5a44', OUT_WARM, z=-2),
            EXTRA: Mat('#9a7a5a', '#c4a07a', '#e8cda0', OUT_WARM, z=1)}
    return c.render(mats)

def glass():
    c = Canvas(W, H)
    _flat(c, 2, 1)
    for x0 in (5, W - 8):                        # тонкие металлические держатели
        c.rect((x0 + 1, 4, x0 + 1, 12), BRACKET)
        c.rect((x0, 12, x0 + 2, 13), BRACKET)
    mats = {SLAB: Mat('#4a6a8a', '#6a9ab8', '#8ad8ff', '#1a2440', dither=False),
            LIP: Mat('#2a3a58', '#3a5272', '#4a6a8a', '#1a2440', z=-1, dither=False),
            BRACKET: Mat('#3a3458', '#6a6a80', '#a89fd0', OUT_COOL, z=-2)}
    return c.render(mats)

def build():
    return {f'ledge_{k}': f() for k, f in (('street', street), ('room', room), ('stage', stage), ('glass', glass))}
