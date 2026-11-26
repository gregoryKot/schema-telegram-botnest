"""Мама в «Среде»: видеозвонок. Огромный телефон с мамой на экране (кадры 40x60), стена из интерфейса
звонка (40x132) и цель главы — телефон на тумбе (34x62). Мама тёплая и обычная: кардиган терракоты,
седые волосы в пучке, смотрит в камеру. В сбое лицо стёрто (как KEY_BLANK у коллег), рамка кислотная."""
from px import Canvas, Mat, strip
from week_rig import OUT, _stamp
from week_props import MATS as PROPS, PINK, PAPER, DARK

ACID = '#ff3ea5'
(BODY, SCREEN, LAMP, CARD, BLOUSE, SKIN, HAIR, EYE, MOUTH, CHEEK, LID, BLANK, RED, GREY, WOOD, TOP, KNOB, MUG, LEAF) = range(20, 39)
HEAD_MOM = [
    ".....bbbb.....",
    "....bbbbbb....",
    ".....bbbb.....",
    "...hhhhhhhh...",
    "..hhhhhhhhhh..",
    ".hhhhhhhsssshh",
    ".hhhssssssssh.",
    ".hhssssssssss.",
    ".hssrrssssrrs.",
    ".hssesssssess.",
    ".hscssssssscs.",
    "..sssmssmsss..",
    "..ssssmmssss..",
    "...ssssssss...",
    "....ssssss....",
]
SMILE = {9: ".hseesssseess.", 11: "..ssmssssmss..", 12: "..sssmmmmsss.."}       # закрытые глаза и улыбка — кадр «после»
KEY = {'b': HAIR, 'h': HAIR, 's': SKIN, 'r': HAIR, 'e': EYE, 'm': MOUTH, 'c': CHEEK}
KEY_SHUT = dict(KEY, e=LID)
KEY_BLANK = dict(KEY, s=BLANK, r=BLANK, e=BLANK, m=BLANK, c=BLANK)

def _mats(glitch=False, dim=False):
    flat = lambda a, b, c, z, **k: Mat(a, b, c, out=OUT, z=z, shade=0, rim=False, **k)
    m = dict(PROPS)
    m.update({
        BODY: Mat('#0b0820', '#1c1530', '#3a3054', out='#0b0820', z=1, shade=1, dither=False),
        SCREEN: flat('#2e2236', '#3a2a40', '#4a3448', 2) if dim else flat('#6a4458', '#8a5a66', '#a8706e', 2),
        LAMP: flat('#f2c58a', '#ffe2b0', '#ffffff', 2),
        CARD: Mat('#8a4436', '#c0664a', '#e39470', out=OUT, z=3, shade=1, dither=False),
        BLOUSE: flat('#c9b8a8', '#f2e6d6', '#ffffff', 4),
        SKIN: flat('#c08a70', '#eab594', '#fbd9bc', 5), HAIR: Mat('#6e6878', '#a9a2b4', '#dcd6e2', out=OUT, z=5, shade=1, dither=False),
        EYE: flat(OUT, OUT, OUT, 5), MOUTH: flat('#9a4a44', '#9a4a44', '#9a4a44', 5), CHEEK: flat('#e8907a', '#e8907a', '#e8907a', 5),
        LID: flat('#8a5040', '#8a5040', '#8a5040', 5), BLANK: Mat('#cfc8e0', '#ece8f4', '#ffffff', out=OUT, z=5, shade=1, dither=False),
        RED: flat('#a82838', '#e8455a', '#ff8a96', 8), GREY: flat('#3b3357', '#5a5078', '#8a82a8', 8),
        WOOD: Mat('#6a4434', '#a8704e', '#c99070', out=OUT, z=1, shade=2), TOP: Mat('#8a5a40', '#c99070', '#f2c08a', out=OUT, z=2, shade=0),
        KNOB: flat('#b5651d', '#f0a830', '#ffd66b', 3), MUG: Mat('#c9b8a8', '#f2e6d6', '#ffffff', out=OUT, z=3, shade=1, dither=False),
        LEAF: Mat('#2f6a52', '#4c8c6a', '#7cc084', out=OUT, z=3, shade=1, dither=False),
    })
    if glitch:
        m[BODY], m[SCREEN] = PROPS[PINK], Mat('#0b0820', '#17103a', '#241a54', out='#0b0820', z=2, shade=0, rim=False)
        m[CARD] = Mat('#241a54', '#3b2d80', '#6753b8', out='#0b0820', z=3, shade=1, dither=False)
        m[BLOUSE] = flat('#6753b8', '#8a78d0', '#b8a6ff', 4)
        m[HAIR] = Mat('#3b2d80', '#6753b8', '#b8a6ff', out='#0b0820', z=5, shade=1, dither=False)
        m[RED] = flat(ACID, ACID, ACID, 8)
    return m

def _bust(c, x, y, glitch=False, shut=False, small=False):
    """Мама по пояс на экране: голова-штамп 14x15 в (x, y), плечи в кардигане, ворот блузки; small — голова 6x6."""
    if small:                                                       # крошечная мама на тумбе — пиксели без контура
        c.poly([(x + 1, y + 18), (x + 1, y + 11), (x + 3, y + 8), (x + 10, y + 8), (x + 12, y + 11), (x + 12, y + 18)], CARD)
        c.poly([(x + 5, y + 8), (x + 8, y + 8), (x + 6, y + 11)], BLOUSE)
        for box, col in (((x + 6, y - 2, x + 7, y - 1), '#a9a2b4'), ((x + 4, y, x + 9, y + 5), '#a9a2b4'), ((x + 5, y + 1, x + 8, y + 6), '#eab594'),
                         ((x + 6, y + 7, x + 7, y + 7), '#eab594'), ((x + 5, y + 3, x + 5, y + 3), OUT), ((x + 8, y + 3, x + 8, y + 3), OUT),
                         ((x + 6, y + 5, x + 7, y + 5), '#9a4a44'), ((x + 5, y + 1, x + 6, y + 1), '#a9a2b4')):
            c.irect(box, col)
        return
    rows = [SMILE.get(j, r) for j, r in enumerate(HEAD_MOM)] if shut else HEAD_MOM
    c.poly([(x - 4, y + 40), (x - 4, y + 22), (x - 1, y + 17), (x + 4, y + 15), (x + 10, y + 15), (x + 15, y + 17), (x + 18, y + 22), (x + 18, y + 40)], CARD)
    c.poly([(x + 3, y + 15), (x + 11, y + 15), (x + 7, y + 24)], BLOUSE)
    neck = BLANK if glitch else SKIN
    c.rect((x + 5, y + 13, x + 9, y + 16), neck); c.poly([(x + 5, y + 16), (x + 9, y + 16), (x + 7, y + 19)], neck)
    _stamp(c, rows, KEY_BLANK if glitch else (KEY_SHUT if shut else KEY), x, y)
    for by in (y + 26, y + 31):                                     # пуговицы кардигана
        c.dot(x + 7, by, '#6a3c3a' if not glitch else '#0b0820')

def screen(kind):
    """Телефон в рост человека на полу. kind: 0 — мама звонит, 1 — сбой (лицо стёрто), 2 — после: глаза закрыты, улыбается."""
    c = Canvas(40, 60)
    c.d.rounded_rectangle((5, 2, 34, 59), 5, fill=BODY)
    c.d.rounded_rectangle((8, 7, 31, 53), 2, fill=SCREEN)
    if kind != 1:
        c.ell((9, 8, 19, 18), LAMP)                                 # торшер у мамы за спиной
    _bust(c, 13, 13, glitch=kind == 1, shut=kind == 2)
    if kind != 2:                                                   # кнопки звонка; после — звонок окончен
        for bx, mat in ((10, GREY), (17, RED), (24, GREY)):
            c.ell((bx, 46, bx + 5, 51), mat)
    c.irect((18, 4, 21, 4), '#3a3054' if kind != 1 else '#c21f78')
    c.irect((15, 56, 24, 56), '#3a3054' if kind != 1 else '#ff9ad0')
    if kind != 2:
        c.iline([(19, 48), (20, 48)], '#ffffff')
    if kind == 1:                                                   # строка разрыва по экрану
        c.iline([(8, 31), (14, 31)], ACID); c.iline([(25, 22), (31, 22)], ACID)
    return c.render(_mats(kind == 1, dim=kind == 2))

def call_wall():
    """Стена из интерфейса звонка: красная трубка, микрофон и столб реплик мамы до потолка."""
    c = Canvas(40, 132)
    c.ell((11, 1, 28, 18), RED); c.iline([(15, 10), (17, 8), (22, 8), (24, 10)], '#ffffff', 2); c.irect((14, 10, 16, 12), '#ffffff'); c.irect((23, 10, 25, 12), '#ffffff')
    bubbles = ((2, 22, 34, 1), (5, 37, 30, 0), (0, 52, 36, 1), (13, 81, 26, 1), (1, 96, 32, 0), (4, 110, 35, 1))
    for x, y, w, pink in bubbles:
        mat = PINK if pink else PAPER
        c.d.rounded_rectangle((x, y, x + w, y + 11), 3, fill=mat)
        c.poly([(x + 1, y + 7), (x + 6, y + 11), (x, y + 14)], mat)    # хвост слева: входящее
        for j, ln in enumerate((w - 10, w - 17)):
            c.iline([(x + 5, y + 3 + j * 4), (x + 5 + ln, y + 3 + j * 4)], '#ffffff' if pink else '#5b6382')
    c.ell((12, 66, 27, 79), GREY); c.irect((18, 69, 21, 74), '#ffffff'); c.iline([(16, 73), (17, 76), (22, 76), (23, 73)], '#ffffff')
    c.d.rounded_rectangle((3, 124, 23, 131), 3, fill=PAPER)        # «печатает…»
    for dx in (8, 12, 16):
        c.dot(dx, 127, '#5b6382')
    return c.render(_mats())

def mom_call(glitch=False):
    """Цель главы. Спокойно — телефон на подставке на тумбе, мама на экране; сбой — тёмный монолит без лица."""
    c = Canvas(34, 62)
    if glitch:
        c.d.rounded_rectangle((3, 0, 30, 61), 4, fill=BODY); c.rect((6, 4, 27, 57), SCREEN)
        _bust(c, 10, 14, glitch=True)
        c.rect((6, 52, 27, 57), SCREEN); c.ell((14, 50, 19, 55), RED)
        c.iline([(6, 34), (12, 34)], ACID); c.iline([(21, 24), (27, 24)], ACID); c.iline([(6, 44), (9, 44)], ACID)
        return c.render(_mats(True))
    c.rect((5, 42, 28, 61), WOOD); c.rect((3, 39, 30, 41), TOP)
    c.irect((8, 50, 25, 50), '#6a4434'); c.rect((15, 45, 18, 46), KNOB)
    c.poly([(12, 38), (21, 38), (19, 34), (14, 34)], DARK)
    c.d.rounded_rectangle((10, 9, 23, 35), 2, fill=BODY); c.rect((11, 11, 22, 32), SCREEN); c.ell((11, 11, 16, 16), LAMP)
    _bust(c, 10, 16, small=True)
    c.rect((24, 34, 28, 38), MUG); c.ell((5, 30, 10, 36), LEAF); c.ell((3, 33, 8, 38), LEAF); c.rect((5, 36, 9, 38), WOOD)
    for x in range(4, 30, 2):                                       # отсвет экрана на столешнице
        c.dot(x, 39, '#ffe2b0' if abs(x - 16) < 9 else '#f2c08a')
    return c.render(_mats())

def sprites():
    return {'wk_mom_screen': strip([screen(k) for k in range(3)]), 'wk_call_wall': call_wall(),
            'wk_mom_call': strip([mom_call(), mom_call(True)])}
