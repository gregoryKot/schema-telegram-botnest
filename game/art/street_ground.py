"""Пол улицы гл.1 по эталону: светлая кромка бордюра, плитка со швами, кирпич подпорной
стенки, уходящий в тень ступенями. Лист 96x64 — шесть столбов 16x64:
0 — берег справа от ямы, 1/3/4 — середины, 2 — берег слева от ямы, 5 — темнота ямы.
Берега: плитка нависает над ямой, ряды кирпича обломаны на разную глубину; за ними — яма."""
import random
from PIL import Image, ImageDraw
from px import C, PAL

P = PAL['ch1']
T, DEEP = 16, 64
SHADE, SOIL = 31, 43                                      # с этих строк стенка темнеет
PIT_BANDS = [(0, '#4a2238'), (14, '#3a1a30'), (30, '#2a1226'), (44, '#1c0b1a')]
JUT = {2: [5, 2, 7, 0, 4, 1, 6, 0, 3], 0: [2, 6, 3, 0, 5, 1, 4, 7, 0]}   # вылет рядов кирпича в яму

def pit(d, ox):
    for i, (y0, col) in enumerate(PIT_BANDS):
        d.rectangle((ox, y0, ox + T - 1, DEEP - 1), fill=C(col))
        if i:                                             # ступень темноты — шахматкой
            d.point([(ox + x, y0 - 1) for x in range(T) if (x + y0) % 2], fill=C(col))
    for r, y in enumerate(range(7, PIT_BANDS[2][0] - 5, 6)):   # дальняя стенка: кладка тонет в темноте
        d.line((ox, y + 5, ox + T - 1, y + 5), fill=C(PIT_BANDS[1 if y < 14 else 2][1]))
        bx = ox + (3 if r % 2 else 11)
        d.line((bx, y, bx, y + 4), fill=C(PIT_BANDS[1 if y < 14 else 2][1]))

def wall(d, ox, rnd, variant):
    d.rectangle((ox, 0, ox + T - 1, DEEP - 1), fill=C(P['wall']))
    d.line((ox, 0, ox + T - 1, 0), fill=C(P['curb_hi']))
    d.rectangle((ox, 1, ox + T - 1, 5), fill=C(P['curb']))
    d.line((ox + 7, 1, ox + 6, 5), fill=C(P['pave']))     # шов плитки
    if variant == 4:                                      # скол плитки
        d.point([(ox + 12, 1), (ox + 13, 1), (ox + 13, 2)], fill=C(P['pave']))
    if variant == 3:                                      # потёртость
        d.line((ox + 10, 3, ox + 13, 3), fill=C(P['curb_hi']))
    d.line((ox, 6, ox + T - 1, 6), fill=C(P['pave_sh']))
    for y in range(SHADE, DEEP):                          # низ уходит в тень
        col = C(P['wall_dk'] if y < SOIL else P['soil'])
        d.point([(ox + x, y) for x in range(T) if y not in (SHADE, SOIL) or (x + y) % 2 == 0], fill=col)
    for r, y in enumerate(range(7, DEEP, 6)):             # кирпич: ряды со сдвигом в полкирпича
        dark = P['wall_dk'] if y + 5 < SHADE else P['soil']
        if y < SOIL:
            d.line((ox, y + 5, ox + T - 1, y + 5), fill=C(dark))
            bx = ox + (3 if r % 2 else 11)
            d.line((bx, y, bx, y + 4), fill=C(dark))
            if r < 3 and rnd.random() < .5:
                d.line((bx + 2, y, bx + 7, y), fill=C(P['wall_hi']))

def bank(d, ox, frame):
    """Берег ямы: за гранью стены — темнота, из неё торчат обломанные ряды кирпича."""
    right = frame == 2                                    # яма справа от столба
    face = ox + 8 if right else ox + 7
    cut = (face + 1, 7, ox + T - 1, DEEP - 1) if right else (ox, 7, face - 1, DEEP - 1)
    tile = Image.new('RGBA', (T, DEEP)); pit(ImageDraw.Draw(tile), 0)
    d._image.paste(tile.crop((cut[0] - ox, 7, cut[2] - ox + 1, DEEP)), (cut[0], 7))
    for r, y in enumerate(range(7, DEEP - 4, 6)):
        k = JUT[frame][r % 9]
        if not k:
            continue
        xa, xb = (face + 1, face + k) if right else (face - k, face - 1)
        deep = r > 3
        d.rectangle((xa, y, xb, y + 4), fill=C(P['wall_dk'] if deep else P['wall']))
        d.line((xa, y, xb, y), fill=C(P['wall'] if deep else P['wall_hi']))
        d.line((xa, y + 5, xb, y + 5), fill=C(P['ink']))
        tip = xb if right else xa
        d.line((tip, y, tip, y + 4), fill=C(P['ink']))
    # грань стены: левый берег смотрит на солнце, правый — в тени
    for y in range(7, DEEP):
        lit = P['wall_hi'] if y < SHADE else P['wall'] if y < SOIL else P['wall_dk']
        d.point((face, y), fill=C(lit if right else P['near_dk'] if y < SOIL else P['soil']))
    # губа бордюра нависает над ямой: контур — только со стороны ямы
    tip = ox + T - 1 if right else ox
    d.line((tip, 1, tip, 6), fill=C(P['ink']))
    d.point((tip, 0), fill=C(P['curb']))
    d.line((face + 1, 6, tip, 6) if right else (tip, 6, face - 1, 6), fill=C(P['ink']))

def sheet():
    img = Image.new('RGBA', (T * 6, DEEP), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for i in range(5):
        wall(d, i * T, random.Random(f'street{i}'), i)
    bank(d, 0, 0); bank(d, 2 * T, 2)
    pit(d, 5 * T)
    return img
