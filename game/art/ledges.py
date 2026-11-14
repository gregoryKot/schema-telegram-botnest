"""A4: карнизы-платформы 48x16 для NineSlice: торец 16 + середина 16 + торец 16.
Показываются x2 (S=2, как пол) — на экране 96x32, как в брифе.

Середина — одинаковые столбцы (без дизеринга и деталей): NineSlice её
растягивает, и одинаковые столбцы растягиваются без «мазни». Всё, что
отвечает на вопрос «на чём держится» (консоли, кронштейны), — на торцах.
Верх (строка 1) — поверхность, по которой ходит кот.
"""
from px import Canvas, Mat, OUT_COOL, OUT_WARM

W, H = 48, 16
SLAB, LIP, BRACKET = 1, 2, 3

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

def build():
    # только карнизы из LEDGE в game/src/props.ts — build.py --install кладёт в ассеты всё, что здесь
    return {f'ledge_{k}': f() for k, f in (('street', street), ('room', room))}
