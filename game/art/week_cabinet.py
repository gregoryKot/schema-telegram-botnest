"""Кабинет терапевта («Первая встреча»): вечерняя комната без сбоя — шалфейная стена над светлой панелью, окно
в сумерки, торшер, книжный шкаф, часы на стене и картина с тихим холмом. Плитка 480x270, период по X.
Терапевт сидит в кресле лицом к Саше, рядом — пустое кресло; кадр 104x62, терапевт по центру кадра."""
from PIL import Image, ImageOps
from px import Canvas, Mat, strip
from week_rig import figure, mats, OUT
from week_cast import HEAD_SHORT, KEY
from week_office import W, H, BASE, PAD
from week_flat import Flat, _finish, _window, _lamp, _shelf, _plant, WIN_A, WIN_B, TRIM, DARKWOOD

WALL, PANEL, PANEL_LO, FLOOR, SEAM = '#93a894', '#e9dcc4', '#cdbd9f', '#b9825a', '#96623f'
FW, FH = 104, 62
GY = FH - 3
BACK, SEAT, WOOD = 1, 2, 3
CHAIR = {BACK: Mat('#255a5c', '#357f7c', '#62aaa0', out=OUT, z=1, shade=2, dither=False),
         SEAT: Mat('#2f6c6a', '#4b9790', '#86c8b8', out=OUT, z=2, shade=1, dither=False),
         WOOD: Mat('#4a2e28', '#6a4434', '#a8704e', out=OUT, z=0, shade=0, rim=False)}
SAGE, CHARCOAL, GREY = ('#7a5a3c', '#c99a62', '#f0cf9a'), ('#1c1a30', '#2b2a44', '#3f3e5e'), ('#5a5460', '#8c8692', '#c4bec8')
# сидит прямо, ладони на коленях; кадр 1 — чуть подаётся вперёд: слушает
SIT = (dict(hip=(15, 12), lean=-2, legs=((84, 2), (88, -2)), arms=((24, 74), (18, 78)), head=(0, 0)),
       dict(hip=(15, 12), lean=7, legs=((84, 2), (88, -2)), arms=((34, 70), (28, 76)), head=(1, 0)))


def _shell(s, o):
    s.rect((o, 0, o + W, 86), '#6f8274'); s.rect((o, 86, o + W, 89), TRIM)
    s.rect((o, 90, o + W, BASE), WALL)
    s.rect((o, 150, o + W, BASE), PANEL); s.rect((o, 148, o + W, 150), TRIM); s.rect((o, 151, o + W, 151), PANEL_LO)
    for x in range(o + 6, o + W, 40):                           # филёнки панели
        s.rect((x, 158, x + 28, 184), PANEL_LO); s.rect((x + 1, 159, x + 27, 183), PANEL)
    s.rect((o, BASE - 5, o + W, BASE), TRIM); s.rect((o, BASE - 6, o + W, BASE - 6), '#a8977c')
    s.rect((o, BASE, o + W, H), FLOOR)
    for y in (200, 210, 224, 242, 262):                         # доски пола, стыки вразбежку
        s.rect((o, y, o + W, y), SEAM)
    for k, (y0, y1) in enumerate(((200, 210), (210, 224), (224, 242), (242, 262), (262, H))):
        for x in range((k * 37) % 70, W, 70):
            s.rect((x + o, y0, x + o, y1), SEAM)
    s.poly([(150 + o, 204), (420 + o, 204), (432 + o, 216), (138 + o, 216)], '#2f6c6a')   # ковёр
    s.poly([(154 + o, 205), (416 + o, 205), (425 + o, 214), (145 + o, 214)], '#4b9790')
    for x in range(160, 412, 14):
        s.rect((x + o, 209, x + o + 6, 210), '#e9dcc4')


def _clock(s, x, y):
    """Часы на стене — туда Саша смотрит, когда уводит разговор."""
    s.ell((x - 10, y - 10, x + 10, y + 10), DARKWOOD); s.ell((x - 8, y - 8, x + 8, y + 8), '#f6ecdc')
    for dx, dy in ((0, -6), (6, 0), (0, 6), (-6, 0)):
        s.rect((x + dx, y + dy, x + dx, y + dy), '#6a4434')
    s.line([(x, y), (x, y - 5)], '#3a2a2a'); s.line([(x, y), (x + 4, y + 2)], '#c96a4a')


def _picture(s, x, y):
    """Картина: холм и низкое солнце — единственное, что тут «говорит», и говорит тихо."""
    s.rect((x, y, x + 46, y + 34), DARKWOOD); s.rect((x + 2, y + 2, x + 44, y + 32), '#f2e2c4')
    s.ell((x + 26, y + 8, x + 38, y + 20), '#e8a45a')
    s.poly([(x + 2, y + 32), (x + 2, y + 22), (x + 16, y + 15), (x + 30, y + 21), (x + 44, y + 17), (x + 44, y + 32)], '#6f9a80')
    s.poly([(x + 2, y + 32), (x + 2, y + 27), (x + 20, y + 23), (x + 44, y + 28), (x + 44, y + 32)], '#4f7d78')


def _console(s, o):
    """Низкая тумба у стены: салфетки, графин с водой и два стакана."""
    x0, x1 = 166 + o, 236 + o
    s.rect((x0, 172, x1, 200), DARKWOOD); s.rect((x0 + 2, 174, x1 - 2, 176), '#a8704e')
    for x in (x0 + 4, x0 + 37):
        s.rect((x, 180, x + 29, 197), '#7e4e3a'); s.rect((x + 13, 187, x + 16, 188), '#d8b070')
    s.rect((x0 + 2, 200, x0 + 4, 203), '#3a2a2a'); s.rect((x1 - 4, 200, x1 - 2, 203), '#3a2a2a')
    s.rect((x0 + 8, 165, x0 + 22, 171), '#efe0c6'); s.rect((x0 + 13, 162, x0 + 17, 165), '#ffffff')   # салфетки
    s.poly([(x0 + 42, 158), (x0 + 46, 158), (x0 + 49, 171), (x0 + 39, 171)], '#bfe0e6'); s.rect((x0 + 41, 165, x0 + 47, 171), '#8fc4d2')
    for x in (x0 + 54, x0 + 61):
        s.rect((x, 166, x + 4, 171), '#d6eef2')
    s.lit((x0, 172, x1, 204), -0.12, 2, 'rect')


def cabinet():
    s = Flat(False)
    for o in (PAD - W, PAD, PAD + W):
        _shell(s, o)
    for o in (PAD - W, PAD, PAD + W):
        _window(s, o, WIN_A, True); _lamp(s, o); _console(s, o); _clock(s, 200 + o, 118); _shelf(s, o)
        _plant(s, 312 + o); _picture(s, 336 + o, 104); _window(s, o, WIN_B, False); _plant(s, 466 + o)
        s.rect((398 + o, 184, 450 + o, 188), '#a8704e'); s.rect((402 + o, 188, 404 + o, 202), DARKWOOD); s.rect((444 + o, 188, 446 + o, 202), DARKWOOD)
        s.lit((330 + o, 96, 392 + o, 146), 0.16, 10, 'ell', sun=True)       # бра над картиной
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.12, 3, 'rect')
    s.grade(0, 92, -0.1, 0.0); s.grade(BASE, H, 0.0, 0.07)
    return _finish(s)


def _chair(c, x, front):
    """Кресло лицом вправо, сиденье от x: front — подлокотник поверх сидящего, иначе спинка, сиденье и ножки."""
    if front:
        c.d.rounded_rectangle((x + 1, GY - 21, x + 17, GY - 17), 2, fill=SEAT); c.rect((x + 14, GY - 17, x + 16, GY - 10), SEAT)
        return
    c.rect((x + 1, GY - 5, x + 2, GY), WOOD); c.rect((x + 16, GY - 5, x + 17, GY), WOOD)
    c.d.rounded_rectangle((x - 5, GY - 37, x + 4, GY - 6), 4, fill=BACK)
    c.d.rounded_rectangle((x - 2, GY - 13, x + 19, GY - 5), 3, fill=SEAT)


def therapist(pose):
    """Кадр до зеркала: терапевт лицом вправо, бедро в x=52; пустое кресло Саши — справа, спинкой наружу."""
    back, front = Canvas(FW, FH), Canvas(FW, FH)
    back.uell((30, GY - 1, 96, GY + 3), '#2a2140')
    _chair(back, 46, False); _chair(front, 46, True)
    out = back.render(CHAIR)
    look = dict(head=HEAD_SHORT, key=KEY, mats=mats(SAGE, CHARCOAL, GREY, skin=('#a8705a', '#d79c7c', '#f0c4a4')))
    out.alpha_composite(figure(pose, look), (37, GY - 59))
    out.alpha_composite(front.render(CHAIR))
    mine_b, mine_f = Canvas(FW, FH), Canvas(FW, FH)
    _chair(mine_b, 8, False); _chair(mine_f, 8, True)
    empty = mine_b.render(CHAIR); empty.alpha_composite(mine_f.render(CHAIR))
    out.alpha_composite(ImageOps.mirror(empty).crop((FW - 30, 0, FW, FH)), (FW - 32, 0))
    return ImageOps.mirror(out)


def sprites():
    return {'wk_therapist': strip([therapist(p) for p in SIT])}
