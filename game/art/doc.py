"""B4 (часть): терапевт гл.4 — старший дымчатый кот с белой грудкой, в очках,
с пледом на коленях (бриф, B4). Сидит, смотрит вправо (код отражает к Мистеру).

doc_idle — 8 кадров 48x48: дыхание и медленный кивок;
doc_talk — 4 кадра: лёгкое движение головы и рта.
"""
from cat import oval
from px import Canvas, Mat, OUT_CAT, OUT_WARM, strip

FAR, TAIL, BODY, CHEST, HEAD, PLAID, NEAR = 1, 2, 3, 4, 5, 6, 7
GREY = ('#4a4a5c', '#6a6a80', '#9a9ab0')
MATS = {
    FAR:   Mat('#3a3a48', '#4a4a5c', '#6a6a80', OUT_CAT, z=0),
    TAIL:  Mat(*GREY, OUT_CAT, z=1),
    BODY:  Mat(*GREY, OUT_CAT, shade=2, z=2),
    CHEST: Mat('#b8b8c8', '#e0e0e8', '#f4f4f8', OUT_CAT, z=3),
    HEAD:  Mat(*GREY, OUT_CAT, z=4),
    PLAID: Mat('#7a3a2a', '#b0563a', '#d07a50', OUT_WARM, z=5),
    NEAR:  Mat(*GREY, OUT_CAT, z=6),
}
EYE, NOSE, GLASSES, STRIPE, STRIPE2 = '#a8e8d0', '#d9738a', '#2a2a36', '#e8a860', '#5a2a22'

def frame(breath=0.0, nod=0, turn=0, mouth=False, blink=False):
    c = Canvas(48, 48)
    c.line([(25, 44), (25, 38)], FAR, 2)                          # дальняя лапа
    c.line([(15, 45), (9, 45), (5, 42), (5, 38)], TAIL, 2)        # хвост вокруг
    c.poly(oval(21, 34 - breath, 9, 10 + breath, -0.2), BODY)
    c.poly(oval(27, 29 - breath, 3.2, 5.5), CHEST)
    hx, hy = 29 + turn, 19 + nod - round(breath)
    c.poly(oval(hx, hy, 6.4, 5.8), HEAD)
    c.poly([(hx - 6, hy - 2), (hx - 4, hy - 10), (hx - 1, hy - 4)], HEAD)   # уши
    c.poly([(hx + 1, hy - 5), (hx + 4, hy - 10), (hx + 6, hy - 2)], HEAD)
    c.poly(oval(20, 41, 11, 5, 0.05), PLAID)                      # плед на коленях
    c.poly([(10, 41), (17, 42), (16, 47), (9, 47)], PLAID)          # край свисает
    c.line([(29, 36), (30, 46)], NEAR, 2)                         # передняя лапа поверх
    c.poly(oval(31, 46, 2, 1.2), NEAR)
    for y in range(36, 48):                                       # клетка пледа — только по ткани
        for x in range(8, 32):
            if c.m.getpixel((x, y)) == PLAID and (x - 1) % 5 == 0:
                c.dot(x, y, STRIPE)
            elif c.m.getpixel((x, y)) == PLAID and y in (40, 44):
                c.dot(x, y, STRIPE2)
    ex, ey = hx + 1, hy - 1                                       # глаза и очки
    for x in (ex, ex + 4):
        c.irect((x - 1, ey - 1, x + 1, ey + 1), GLASSES)
        c.dot(x, ey, '#4a4a5c' if blink else EYE)
    c.dot(ex + 2, ey, GLASSES)                                    # перемычка
    c.dot(hx + 6, hy + 2, NOSE)
    if mouth:
        c.dot(hx + 5, hy + 4, '#2a2a36')
    return c.render(MATS)

def idle():
    breath = (0, 0.5, 1, 0.5, 0, 0.5, 1, 0.5)
    nod = (0, 0, 0, 0, 1, 1, 0, 0)
    return [frame(b, n, blink=(i == 6)) for i, (b, n) in enumerate(zip(breath, nod))]

def talk():
    return [frame(0, 0, 0, False), frame(0, 0, 1, True), frame(0.5, 1, 0, False),
            frame(0, 0, 1, True)]

def build():
    return {'doc_idle': strip(idle()), 'doc_talk': strip(talk())}
