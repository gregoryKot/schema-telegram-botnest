"""Пропсы обучения на сетке x2 (палитра CH2): кровать, рабочий стол, дверь, будильник.
Те же материалы и свет, что у мебели дома (furniture.py)."""
from px import PAL
from furniture import M, canvas, WOOD, RUG, SCREEN, INK

P = PAL['ch2']
LINEN = ('#d9a886', P['trim'], '#fff6e0')
BRASS = ('#b8683a', P['shade'], P['lamp'])

def bed():
    """Кровать 110x50: изголовье слева, подушка, плед с отворотом."""
    c, Y = canvas(110, 50)
    HEAD, FOOT, FRAME, MATT, BLANKET, PILLOW, LEG, FOLD = 1, 2, 3, 4, 5, 6, 7, 8
    c.rect((2, Y(46), 9, Y(5)), HEAD); c.rect((100, Y(26), 107, Y(5)), FOOT)
    c.rect((8, Y(13), 101, Y(7)), FRAME)
    c.rect((10, Y(21), 99, Y(14)), MATT)
    c.rect((34, Y(25), 99, Y(13)), BLANKET); c.rect((34, Y(25), 41, Y(13)), FOLD)
    c.rect((12, Y(27), 31, Y(21)), PILLOW)
    for x0 in (3, 103):
        c.rect((x0, Y(4), x0 + 3, Y(1)), LEG)
    for x in range(48, 96, 10):                           # клетка пледа
        c.iline([(x, Y(23)), (x, Y(15))], RUG[0])
    c.iline([(43, Y(19)), (98, Y(19))], RUG[0])
    for a in (40, 30, 20):
        c.iline([(4, Y(a)), (7, Y(a))], WOOD[0])
    mats = {HEAD: M(WOOD, shade=2), FOOT: M(WOOD, shade=2), FRAME: M(WOOD, z=1), MATT: M(LINEN, z=2),
            BLANKET: M(RUG, z=3, shade=2), FOLD: M(LINEN, z=4), PILLOW: M(LINEN, z=4), LEG: M(WOOD)}
    return c.render(mats)

def desk():
    """Стол 92x58: монитор с холодным экраном, стопка бумаг, кружка — работа, которая не кончается."""
    c, Y = canvas(92, 58)
    TOP, LEG, DRAWER, MON, SCR, NECK, PAPER, MUG = 1, 2, 3, 4, 5, 6, 7, 8
    c.rect((1, Y(31), 90, Y(28)), TOP)
    c.rect((4, Y(27), 7, Y(1)), LEG)
    c.rect((58, Y(27), 86, Y(1)), DRAWER)
    c.rect((36, Y(55), 68, Y(36)), MON); c.rect((38, Y(53), 66, Y(38)), SCR)
    c.rect((50, Y(35), 54, Y(32)), NECK); c.rect((46, Y(32), 58, Y(32)), NECK)
    for i in range(4):                                    # стопка бумаг чуть вразнобой
        c.rect((8 + i % 2, Y(33 + i * 2), 24 + i % 2, Y(32 + i * 2)), PAPER)
    c.rect((76, Y(37), 81, Y(32)), MUG)
    for a in (22, 13, 4):                                 # ящики с ручками
        c.iline([(60, Y(a)), (84, Y(a))], WOOD[0]); c.irect((70, Y(a + 5), 74, Y(a + 4)), P['trim'])
    for a, w in ((50, 14), (47, 20), (44, 10), (41, 17)):  # строчки на экране
        c.iline([(41, Y(a)), (41 + w, Y(a))], SCREEN[2])
    c.irect((82, Y(36), 82, Y(34)), RUG[1]); c.iline([(10, Y(41)), (20, Y(41))], '#d9a886')
    mats = {TOP: M(WOOD, z=2), LEG: M(WOOD), DRAWER: M(WOOD, shade=2), MON: M((INK, '#4a3540', '#6e5560'), z=3),
            SCR: M(SCREEN, z=4, rim=False, shade=0), NECK: M((INK, '#4a3540', '#6e5560'), z=3),
            PAPER: M(LINEN, z=3), MUG: M(RUG, z=3)}
    return c.render(mats)

def door():
    """Дверь 46x88: наличник, четыре филёнки, латунная ручка."""
    c, Y = canvas(46, 88)
    FRAME, LEAF, PANEL, KNOB = 1, 2, 3, 4
    c.rect((1, Y(86), 44, Y(1)), FRAME)
    c.rect((5, Y(82), 40, Y(1)), LEAF)
    for x0 in (9, 25):
        c.rect((x0, Y(76), x0 + 11, Y(46)), PANEL); c.rect((x0, Y(36), x0 + 11, Y(8)), PANEL)
    c.ell((33, Y(43), 37, Y(39)), KNOB)
    mats = {FRAME: M((P['wood'], P['wood_hi'], P['trim'])), LEAF: M(WOOD, z=1, shade=2),
            PANEL: M((P['wood_hi'], P['wood'], P['wood_dk']), z=2, shade=1, dither=False), KNOB: M(BRASS, z=3)}
    return c.render(mats)

def alarm():
    """Будильник 18x20: два звонка, красный корпус, стрелки на «пора»."""
    c, Y = canvas(18, 20)
    BODY, FACE, BELL, FOOT = 1, 2, 3, 4
    c.line([(4, Y(2)), (2, Y(1))], FOOT); c.line([(13, Y(2)), (15, Y(1))], FOOT)
    c.ell((2, Y(15), 15, Y(2)), BODY); c.ell((4, Y(13), 13, Y(4)), FACE)
    c.ell((1, Y(18), 6, Y(14)), BELL); c.ell((11, Y(18), 16, Y(14)), BELL)
    c.rect((8, Y(18), 9, Y(16)), FOOT)
    c.iline([(8, Y(8)), (8, Y(11))], INK); c.iline([(9, Y(8)), (11, Y(9))], INK)
    mats = {BODY: M(RUG, z=1), FACE: M(LINEN, z=2, shade=0), BELL: M(BRASS, z=3), FOOT: M((INK, '#4a3540', '#6e5560'))}
    return c.render(mats)

def build():
    return {'prop_bed': bed(), 'prop_desk': desk(), 'prop_door': door(), 'prop_alarm': alarm()}
