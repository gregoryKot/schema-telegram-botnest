"""Маленький Саша («Воскресенье», цель главы): кадр 34x62, сидит на полу лицом к Саше. Тот же капюшон и те же
цвета, что у взрослого, рост вдвое меньше; горчичные кеды — то же тёплое пятно, что рюкзак.
Кадр 0 — сбой назван: голова поднята, руки на коленях. Кадр 1 — сбой: обнял колени, голова опущена."""
from PIL import ImageOps
from px import Canvas, strip
from week_rig import mats, _limb, _pt, _shoe, _stamp, FAR_ARM, FAR_LEG, FAR_SHOE, TORSO, LEG, SHOE, SOLE, ARM, HAND
from week_cast import HEAD_SASHA, KEY, KEY_SHUT, HOODIE, JEANS, INK_HAIR, MUSTARD

FW, FH = 34, 62
GY = FH - 2
POSES = (
    dict(lean=2, thigh=112, shin=8, arms=((28, 78), (18, 72)), head=(1, 0), key=KEY),           # смотрит на Сашу
    dict(lean=16, thigh=122, shin=4, arms=((58, 70), (48, 62)), head=(2, 3), key=KEY_SHUT),     # обнял колени
)


def little(p):
    c = Canvas(FW, FH)
    m = mats(HOODIE, JEANS, INK_HAIR, shoe=MUSTARD)
    hx, hy = 9, GY - 3
    sx, sy = _pt(hx, hy, 180 - p['lean'], 9)                    # плечи
    c.uell((hx - 9, GY - 1, hx + 19, GY + 3), '#2a2140')        # тень на полу: сидит, а не висит в пустоте
    for mat_leg, mat_shoe, sole, dx in ((FAR_LEG, FAR_SHOE, None, 1), (LEG, SHOE, SOLE, -1)):
        ex, ey = _limb(c, hx + dx, hy, p['thigh'], p['shin'], 8, 8, mat_leg, 4, 3)
        _shoe(c, ex, min(ey, GY - 1), 0, mat_shoe, sole)
    _limb(c, sx + 1, sy + 2, *p['arms'][0], 5, 5, FAR_ARM, 3, 3)
    c.poly([(hx - 4, hy + 2), (hx + 4, hy + 2), (sx + 4, sy), (sx + 3, sy - 1), (sx - 3, sy - 1), (sx - 4, sy)], TORSO)
    hdx, hdy = p['head']
    _stamp(c, HEAD_SASHA, p['key'], round(sx + hdx) - 5, round(sy - 11 + hdy))
    ex, ey = _limb(c, sx - 1, sy + 2, *p['arms'][1], 5, 5, ARM, 3, 3)
    c.ell((ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5), HAND)
    return ImageOps.mirror(c.render(m))


def sprites():
    return {'wk_little': strip([little(p) for p in POSES])}

