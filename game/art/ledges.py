"""A4: карнизы-платформы 48x16 для NineSlice: торец 16 + середина 16 + торец 16.
Показываются x2 (S=2, как пол) — на экране 96x32, как в брифе.

Середина — одинаковые столбцы (без дизеринга и деталей): NineSlice её
растягивает, и одинаковые столбцы растягиваются без «мазни». Всё, что
отвечает на вопрос «на чём держится» (консоли, кронштейны), — на торцах.
Верх (строка 1) — поверхность, по которой ходит кот.
"""
from PIL import Image, ImageDraw
from px import Canvas, Mat, C, PAL, OUT_WARM

W, H = 48, 16
SLAB, LIP, BRACKET = 1, 2, 3

def _flat(c, top, lip):
    c.rect((1, 1, W - 2, top), SLAB)
    c.rect((2, top + 1, W - 3, top + lip), LIP)

def street():
    """Уступ эталона: светлая кромка, тёмный фасад, тёплый контур — контрастен на любом слое."""
    P = PAL['ch1']
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W - 1, 10), fill=C(P['ink']))
    for y, col in ((1, '#fff0c4'), (2, P['curb_hi']), (3, P['curb_hi']), (4, P['curb']), (5, P['pave_sh']),
                   (6, P['wall']), (7, P['wall_dk']), (8, P['wall_dk']), (9, P['wall_dk'])):
        d.line((1, y, W - 2, y), fill=C(col))
    for bx in (5, W - 12):                       # кронштейны и швы камня — только на торцах
        d.polygon([(bx - 1, 11), (bx + 7, 11), (bx + 5, 15), (bx + 1, 15)], fill=C(P['ink']))
        d.polygon([(bx, 11), (bx + 6, 11), (bx + 4, 14), (bx + 2, 14)], fill=C(P['near_dk']))
        d.line((bx + 6, 11, bx + 4, 14), fill=C(P['near_rim']))
        d.line((bx + 4, 7, bx + 4, 9), fill=C(P['near_dk']))
    return img

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
