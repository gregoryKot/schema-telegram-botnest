"""Мебель дома (гл.2, кабинет, старт) на сетке x2, палитра CH2: диван, ТВ, стеллаж, растение,
торшер, ковёр, картины. Низ спрайта — линия пола; свет в комнате сверху-слева (кромки Mat).
"""
import random
from PIL import Image
from px import Canvas, Mat, C, PAL, strip
from tile import BAYER4

P = PAL['ch2']
INK = P['ink']
WOOD = (P['wood_dk'], P['wood'], P['wood_hi'])
SOFA = ('#35506e', P['sofa'], P['sofa_hi'])
RUG = ('#8a3348', P['rug'], P['rug_hi'])
LEAF = ('#3e6650', P['plant'], P['plant_hi'])
SCREEN = ('#3a4a7a', '#7fb6e8', '#d6f0ff')
BOOKS = [P['rug'], P['sofa'], P['plant'], P['shade'], P['trim'], P['window'], '#8a3348', P['sofa_hi']]

def M(ramp, **kw):
    return Mat(*ramp, out=INK, **kw)

def canvas(w, h):
    """Холст и перевод «высоты над полом» в строку: a=1 — первая строка над контуром низа."""
    c = Canvas(w, h)
    return c, lambda a: h - 1 - a

def couch():
    """Диван 114x48: сиденье на 21 px над полом — на нём лежит Прокрастинация и спит кот на старте."""
    c, Y = canvas(114, 48)
    BACK, ARM, CUSH, BASE, LEG, PIL, BCUSH = 1, 2, 3, 4, 5, 6, 7
    c.rect((11, Y(45), 102, Y(14)), BACK)
    for x0 in (11, 102):
        c.clear((x0, Y(45), x0, Y(45)))
    for x0 in (15, 58):                                   # две подушки спинки и две — сиденья
        c.rect((x0, Y(42), x0 + 40, Y(20)), BCUSH); c.rect((x0 - 1, Y(21), x0 + 41, Y(13)), CUSH)
        for k in (x0, x0 + 40):
            c.clear((k, Y(42), k, Y(42)))
    c.rect((6, Y(12), 107, Y(5)), BASE)
    for x0 in (1, 97):
        c.rect((x0, Y(27), x0 + 15, Y(5)), ARM); c.ell((x0, Y(33), x0 + 15, Y(22)), ARM)
    for x0 in (9, 101):
        c.rect((x0, Y(4), x0 + 3, Y(1)), LEG)
    c.rect((19, Y(33), 31, Y(22)), PIL); c.clear((19, Y(33), 19, Y(33))); c.clear((31, Y(33), 31, Y(33)))
    for x0 in (15, 58):
        c.dot(x0 + 20, Y(31), SOFA[0]); c.iline([(x0 + 2, Y(40)), (x0 + 37, Y(40))], '#96b8c8')
    for x0 in (1, 97):                                    # торец подлокотника — валик
        c.iell((x0 + 3, Y(31), x0 + 12, Y(23)), SOFA[1]); c.iline([(x0 + 5, Y(30)), (x0 + 9, Y(30))], SOFA[2])
    c.irect((22, Y(30), 28, Y(25)), RUG[2]); c.irect((24, Y(28), 26, Y(27)), P['trim'])   # думка с ромбом
    mats = {BACK: M(SOFA, shade=2), ARM: M(SOFA, z=3, shade=2), CUSH: M(SOFA, z=2, shade=2), BASE: M(SOFA, shade=3),
            LEG: M(WOOD), PIL: M(RUG, z=4), BCUSH: M(('#35506e', '#456480', SOFA[1]), z=1, shade=2)}
    return c.render(mats)

def tv():
    """Тумба и ламповый телевизор: экран холодный — единственное синее пятно в тёплой комнате."""
    c, Y = canvas(66, 64)
    STAND, DOOR, LEG, BODY, SCR = 1, 2, 3, 4, 5
    c.rect((1, Y(20), 64, Y(4)), STAND)
    for x0 in (4, 34):
        c.rect((x0, Y(17), x0 + 27, Y(6)), DOOR)
    for x0 in (4, 58):
        c.rect((x0, Y(3), x0 + 3, Y(1)), LEG)
    c.rect((8, Y(53), 57, Y(21)), BODY)
    c.rect((11, Y(50), 47, Y(25)), SCR)
    c.line([(26, Y(53)), (18, Y(61))], BODY); c.line([(34, Y(53)), (44, Y(60))], BODY)   # усы антенны
    for y in range(Y(50), Y(25) + 1):                     # свечение экрана: полосы и помехи
        for x in range(11, 48):
            k = (y - Y(50)) / 26
            col = SCREEN[2] if k < .2 and BAYER4[y % 4, x % 4] < .5 else SCREEN[1] if k < .75 or (x + y) % 2 else SCREEN[0]
            c.dot(x, y, col)
    c.irect((11, Y(50), 12, Y(49)), INK); c.irect((46, Y(50), 47, Y(49)), INK)           # скруглённые углы
    for a in (47, 42, 37):                                # ручки и динамик
        c.irect((51, Y(a), 54, Y(a - 2)), P['trim'])
    for a in (31, 29, 27):
        c.iline([(50, Y(a)), (55, Y(a))], INK)
    for x0 in (4, 34):
        c.irect((x0 + (22 if x0 == 4 else 3), Y(13), x0 + (23 if x0 == 4 else 4), Y(10)), P['trim'])
    mats = {STAND: M(WOOD, shade=2), DOOR: M(WOOD, z=1), LEG: M(WOOD), BODY: M(('#2e1a1e', '#4a3540', '#6e5560')),
            SCR: M(SCREEN, z=1, rim=False, shade=0)}
    return c.render(mats)

def bookshelf():
    c, Y = canvas(48, 74)
    FRAME, BACKW = 1, 2
    c.rect((1, Y(72), 46, Y(1)), FRAME)
    rnd = random.Random(5)
    for a0 in (4, 21, 38, 55):                            # четыре полки: ниша и книги разной высоты
        c.rect((4, Y(a0 + 14), 43, Y(a0)), BACKW)
        x = 5
        while x < 42:
            w, h = rnd.choice((2, 3, 3, 4)), rnd.randrange(9, 14)
            if rnd.random() < .14:
                x += rnd.choice((2, 5)); continue          # просвет: книгу взяли почитать
            col = rnd.choice(BOOKS)
            c.irect((x, Y(a0 + h - 1), min(x + w - 1, 42), Y(a0)), col)
            c.iline([(x, Y(a0 + h - 1)), (x, Y(a0))], INK)
            if w > 2: c.dot(x + 1, Y(a0 + h - 3), P['trim'])
            x += w
    mats = {FRAME: M(WOOD, shade=2), BACKW: M(('#4a2628', P['wood_dk'], P['wood_dk']), z=1, rim=False, shade=0)}
    return c.render(mats)

def plant():
    c, Y = canvas(34, 48)
    POT, RIM, L1, L2, STEM = 1, 2, 3, 4, 5
    c.poly([(10, Y(11)), (23, Y(11)), (21, Y(1)), (12, Y(1))], POT)
    c.rect((9, Y(14), 24, Y(12)), RIM)
    c.line([(16, Y(15)), (16, Y(30))], STEM); c.line([(17, Y(15)), (21, Y(26))], STEM)
    for box, m in (((2, Y(30), 15, Y(20)), L1), ((18, Y(32), 32, Y(22)), L1), ((6, Y(40), 20, Y(28)), L2),
                   ((15, Y(45), 27, Y(31)), L2), ((1, Y(22), 11, Y(15)), L2), ((22, Y(24), 31, Y(16)), L2)):
        c.ell(box, m)
    for x, a in ((8, 25), (25, 27), (13, 34), (21, 38)):   # прожилки
        c.iline([(x - 3, Y(a)), (x + 2, Y(a))], LEAF[0])
    mats = {POT: M(('#b8683a', P['shade'], '#ffc890'), shade=2), RIM: M(('#b8683a', P['shade'], '#ffc890'), z=1),
            L1: M(LEAF, z=2), L2: M((LEAF[0], '#4c7858', LEAF[1]), z=1), STEM: M(LEAF, z=0)}
    return c.render(mats)

def lamp():
    """Торшер 44x92: абажур светится сам, ореол и пятно на полу — дизером, а не размытием."""
    c, Y = canvas(44, 92)
    SHADE, POLE, FOOT = 1, 2, 3
    cx = 22
    for y in range(c.h):
        for x in range(c.w):
            d = (((x - cx) / 21) ** 2 + ((y - Y(70)) / 21) ** 2) ** .5
            f = (((x - cx) / 21) ** 2 + ((y - Y(1)) / 3) ** 2) ** .5
            if d < 1 and BAYER4[y % 4, x % 4] < (1 - d) * .75 or f < 1 and BAYER4[y % 4, x % 4] < (1 - f):
                c.under.putpixel((x, y), C(P['lamp'] if min(d, f) < .5 else P['lamp_glow']))
    c.poly([(cx - 6, Y(81)), (cx + 5, Y(81)), (cx + 11, Y(63)), (cx - 12, Y(63))], SHADE)
    c.rect((cx - 1, Y(62), cx, Y(4)), POLE)
    c.poly([(cx - 5, Y(4)), (cx + 4, Y(4)), (cx + 7, Y(1)), (cx - 8, Y(1))], FOOT)
    c.iline([(cx - 11, Y(64)), (cx + 10, Y(64))], P['shade'])
    c.iline([(cx + 5, Y(62)), (cx + 5, Y(56))], P['wood_dk']); c.dot(cx + 5, Y(55), P['trim'])   # шнурок
    mats = {SHADE: M((P['shade'], P['lamp'], '#fff6d8'), dither=False), POLE: M(WOOD, z=-1), FOOT: M(WOOD)}
    return c.render(mats)

def rug():
    """Ковёр в профиль: полоса 4 px с узором и бахромой по краям."""
    img = Image.new('RGBA', (136, 4), (0, 0, 0, 0))
    for x in range(2, 134):
        for y, col in enumerate((RUG[2], RUG[1], RUG[1] if x % 8 > 1 else P['trim'], RUG[0])):
            img.putpixel((x, y), C(col))
    for x in (0, 1, 134, 135):
        img.putpixel((x, 3), C(P['trim'])); img.putpixel((x, 2), C(P['trim']) if x in (1, 134) else (0, 0, 0, 0))
    return img

def picture(kind):
    c, Y = canvas(24, 20)
    c.rect((1, 1, 22, 18), 1)
    sky = ('#6a5a9e', '#b06a9a', '#e88aa0', '#ffc878') if kind == 0 else (P['trim'],) * 4
    for i, col in enumerate(sky):
        c.irect((4, 4 + i * 3, 19, 6 + i * 3), col)
    if kind == 0:                                         # закат над крышами — память о дороге домой
        c.irect((4, 13, 19, 15), '#5a3a5e'); c.irect((7, 11, 10, 15), '#5a3a5e'); c.irect((14, 12, 16, 15), '#5a3a5e')
        c.irect((11, 9, 13, 10), '#fff2c0')
    else:                                                 # сердце: кто-то повесил это для себя
        for x, y in ((9, 7), (10, 7), (13, 7), (14, 7), (8, 8), (15, 8), (11, 8), (12, 8)):
            c.dot(x, y, P['rug'])
        for i in range(5):
            c.iline([(8 + i, 9 + i), (15 - i, 9 + i)], P['rug'])
        c.dot(9, 8, P['rug_hi']); c.dot(10, 8, P['rug']); c.dot(13, 8, P['rug']); c.dot(14, 8, P['rug'])
    return c.render({1: M(WOOD)})

def build():
    return {'prop_couch': couch(), 'prop_tv': tv(), 'prop_bookshelf': bookshelf(), 'prop_plant': plant(),
            'prop_lamp': lamp(), 'prop_rug': rug(), 'prop_picture': strip([picture(0), picture(1)])}
