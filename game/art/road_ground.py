"""Пол дороги гл.3: светлая кромка обочины, укатанная колея с галькой, под ней — слои земли,
темнеющие ступенями. Лист 96x64 — шесть столбов 16x64, как у улицы (street_ground.py):
0 — берег справа от ямы, 1/3/4 — середины, 2 — берег слева от ямы, 5 — темнота ямы."""
import random
from PIL import Image, ImageDraw
from px import C, PAL

P = PAL['ch3']
T, DEEP = 16, 64
STRATA = [(7, P['wall_hi']), (16, P['wall']), (30, P['wall_dk']), (46, P['soil'])]     # слои земли сверху вниз
PIT_BANDS = [(0, '#3a3468'), (14, '#2c2856'), (30, '#201c44'), (44, '#161232')]

def pit(d, ox):
    for i, (y0, col) in enumerate(PIT_BANDS):
        d.rectangle((ox, y0, ox + T - 1, DEEP - 1), fill=C(col))
        if i:
            d.point([(ox + x, y0 - 1) for x in range(T) if (x + y0) % 2], fill=C(col))

def column(d, ox, rnd, variant):
    for i, (y0, col) in enumerate(STRATA):
        d.rectangle((ox, y0, ox + T - 1, DEEP - 1), fill=C(col))
        if i:                                             # граница слоёв — волной и шахматкой
            d.point([(ox + x, y0 - 1 - (x // 4 + variant) % 2) for x in range(T) if (x + y0) % 2], fill=C(col))
    d.line((ox, 0, ox + T - 1, 0), fill=C(P['curb_hi']))
    d.rectangle((ox, 1, ox + T - 1, 4), fill=C(P['curb']))
    d.line((ox, 5, ox + T - 1, 5), fill=C(P['pave'])); d.line((ox, 6, ox + T - 1, 6), fill=C(P['pave_sh']))
    for x, y in ((2, 2), (9, 3), (13, 1)) if variant != 3 else ((5, 3), (11, 2)):      # галька на колее
        d.point((ox + x, y), fill=C(P['pave'])); d.point((ox + x + 1, y), fill=C(P['curb_hi']))
    if variant == 4:
        d.line((ox + 4, 4, ox + 8, 4), fill=C(P['pave']))                              # выбоина
    for y0 in (22, 38, 54):                                # прожилки слоёв — редкие, со сдвигом
        x = (variant * 5 + y0) % 9
        d.line((ox + x, y0, ox + x + 5, y0), fill=C(P['wall_dk'] if y0 < 30 else P['soil'] if y0 < 46 else PIT_BANDS[2][1]))
    for _ in range(2):                                    # камни в толще: светлый верх, тень снизу
        x, y = rnd.randrange(1, T - 5), rnd.randrange(11, DEEP - 8)
        lit = P['wall_hi'] if y < 28 else P['wall'] if y < 44 else P['wall_dk']
        d.rectangle((ox + x, y, ox + x + 3, y + 2), fill=C(lit)); d.line((ox + x + 1, y - 1, ox + x + 2, y - 1), fill=C(lit))
        d.line((ox + x, y + 3, ox + x + 3, y + 3), fill=C(PIT_BANDS[1][1]))

def bank(d, ox, frame):
    """Берег ямы: обрыв с выступами слоёв, кромка дороги нависает."""
    right = frame == 2
    face = ox + 9 if right else ox + 6
    cut = (face + 1, 7, ox + T - 1, DEEP - 1) if right else (ox, 7, face - 1, DEEP - 1)
    tile = Image.new('RGBA', (T, DEEP)); pit(ImageDraw.Draw(tile), 0)
    d._image.paste(tile.crop((cut[0] - ox, 7, cut[2] - ox + 1, DEEP)), (cut[0], 7))
    for y0, k in ((9, 3), (20, 1), (27, 4), (40, 2), (52, 3)):                         # выступы породы
        xa, xb = (face + 1, face + k) if right else (face - k, face - 1)
        lit = P['wall'] if y0 < 30 else P['wall_dk']
        d.rectangle((xa, y0, xb, y0 + 4), fill=C(lit)); d.line((xa, y0 + 5, xb, y0 + 5), fill=C(P['ink']))
        d.line((xa, y0, xb, y0), fill=C(P['wall_hi'] if y0 < 30 else P['wall']))
    for y in range(7, DEEP):                              # грань: правый берег ловит зарево, левый — в тени
        d.point((face, y), fill=C((P['pave'] if y < 30 else P['wall_hi']) if not right else P['ink']))
    tip = ox + T - 1 if right else ox
    d.line((tip, 1, tip, 6), fill=C(P['ink'])); d.point((tip, 0), fill=C(P['curb']))
    d.line((face + 1, 6, tip, 6) if right else (tip, 6, face - 1, 6), fill=C(P['ink']))

def sheet():
    img = Image.new('RGBA', (T * 6, DEEP), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for i in range(5):
        column(d, i * T, random.Random(f'road{i}'), i)
    bank(d, 0, 0); bank(d, 2 * T, 2)
    pit(d, 5 * T)
    return img
