"""A4: карнизы-платформы 48x16 для NineSlice: торец 16 + середина 16 + торец 16.
Показываются x2 (S=2, как пол) — на экране 96x32, как в брифе.

Середина — одинаковые столбцы (без дизеринга и деталей): NineSlice её
растягивает, и одинаковые столбцы растягиваются без «мазни». Всё, что
отвечает на вопрос «на чём держится» (консоли, кронштейны), — на торцах.
Верх (строка 1) — поверхность, по которой ходит кот.
"""
from PIL import Image, ImageDraw
from px import C, PAL

W, H = 48, 16

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
    """Полка гл.2: тёплое дерево, светлая кромка сверху; кронштейны-угольники — на торцах."""
    P = PAL['ch2']
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W - 1, 6), fill=C(P['ink']))
    for y, col in ((1, P['trim']), (2, P['wood_hi']), (3, P['wood']), (4, P['wood']), (5, P['wood_dk'])):
        d.line((1, y, W - 2, y), fill=C(col))
    for bx, s in ((4, 1), (W - 5, -1)):
        d.polygon([(bx - s, 7), (bx + 7 * s, 7), (bx + s, 14), (bx - s, 14)], fill=C(P['ink']))
        d.polygon([(bx, 7), (bx + 5 * s, 7), (bx, 12)], fill=C(P['wood_dk']))
        d.line((bx, 7, bx, 12), fill=C(P['wood']))
    return img

def build():
    # только карнизы из LEDGE в game/src/props.ts — build.py --install кладёт в ассеты всё, что здесь
    return {f'ledge_{k}': f() for k, f in (('street', street), ('room', room))}
