"""Коридор «Понедельника»: плитка 480x270 (период по X) с одинаковыми дверями кабинетов, портал из опенспейса
и кабинет начальницы — вставка 240x270 вместо куска стены. Свет, палитра и сбой — те же, что у опенспейса."""
import numpy as np
from PIL import Image
from week_tone import Scene
from week_office import W, H, BASE, PAD, ACID, finish, _plant, office
from week_cast import cast

BAY, ROOM_W, ARCH = 120, 240, (28, 126)
WALL, WAINS, PLINTH, FLOOR, SEAM = '#c9d6d8', '#a3b4bd', '#6b7d94', '#7484a6', '#6a7a9c'
RUG, RUG_EDGE, RUG_SEAM, RUG_DIA = '#8c5862', '#c98d78', '#74465a', '#a8727a'
DOOR_X = 25                                # центр двери начальницы во вставке

def _shell(s, ox, glitch=False):
    """Потолок, карниз, световые полосы, стена, плинтус, пол с дорожкой — общие для плитки и вставки; ox — фаза по X."""
    s.rect((0, 0, s.w, 86), '#dde6e6'); s.rect((0, 86, s.w, 89), '#8597a6')
    for x in range(ox - BAY, s.w, BAY):                           # светящиеся полосы под карнизом
        off = glitch and (x // BAY) % 2
        s.rect((x + 6, 90, x + 114, 91), '#39415c' if off else '#fff6dc')
        if not off:
            s.lit((x, 86, x + 120, 122), 0.22, 7, 'ell')
    s.rect((0, 92, s.w, 176), WALL); s.rect((0, 176, s.w, BASE), WAINS); s.rect((0, BASE - 3, s.w, BASE), PLINTH)
    s.rect((0, 175, s.w, 175), '#e6edf0')
    s.rect((0, BASE, s.w, H), FLOOR)
    for y in (203, 246):
        s.rect((0, y, s.w, y), SEAM)
    s.rect((0, 208, s.w, 237), RUG); s.rect((0, 209, s.w, 209), RUG_EDGE); s.rect((0, 235, s.w, 235), RUG_EDGE)
    s.rect((0, 212, s.w, 212), RUG_SEAM); s.rect((0, 232, s.w, 232), RUG_SEAM)
    for x in range(ox - 200, s.w, 60):                            # швы уходят к зрителю, на дорожке — ромбы узора
        s.line([(x, BASE), (x + 8, 207)], SEAM); s.line([(x + 23, 238), (x + 39, H)], SEAM)
        for dx in (14, 44):
            s.poly([(x + dx - 7, 222), (x + dx, 218), (x + dx + 7, 222), (x + dx, 226)], RUG_DIA)
            s.poly([(x + dx - 3, 222), (x + dx, 220), (x + dx + 3, 222), (x + dx, 224)], RUG)
    s.lit((0, 207, s.w, 238), -0.05, 1, 'rect'); s.lit((0, 238, s.w, 240), -0.12, 0.5, 'rect')


def _door(s, x0, n, glitch):
    """Дверь кабинета в стене: наличник, полотно, ручка, табличка с номером справа."""
    s.rect((x0 - 3, 125, x0 + 32, BASE - 1), '#eef3f2'); s.rect((x0, 128, x0 + 29, BASE - 1), '#a8765a')
    s.rect((x0 + 3, 132, x0 + 26, 156), '#b98663'); s.rect((x0 + 3, 162, x0 + 26, 186), '#b98663')
    s.rect((x0 + 24, 158, x0 + 27, 159), '#f0a830')
    if glitch:                                                 # сбой: под каждой дверью кислотная щель — любая может быть её
        s.rect((x0 + 1, BASE - 2, x0 + 28, BASE - 1), ACID); s.lit((x0 - 4, BASE - 4, x0 + 33, BASE + 6), 0, 3, 'rect', sun=True)
    s.lit((x0, 128, x0 + 29, 131), -0.25, 0, 'rect'); s.lit((x0 - 6, BASE - 2, x0 + 36, BASE + 6), -0.18, 2, 'rect')
    px, col = x0 + 38, ACID if glitch else '#39415c'
    s.rect((px, 146, px + 11, 155), '#f6f8f6'); s.rect((px + 1, 147, px + 10, 148), col)
    for i in range(3):                                         # номер: столбики разной высоты
        h = 2 + (n * 3 + i * 5) % 3 if not glitch else 4
        s.rect((px + 2 + i * 3, 153 - h, px + 3 + i * 3, 153), col)


def _sconce(s, x, glitch, k):
    on = not (glitch and k % 2)
    s.rect((x - 4, 110, x + 4, 113), '#eef3f2' if on else '#39415c'); s.rect((x - 1, 114, x + 1, 115), '#8597a6')
    if on:
        s.lit((x - 14, 96, x + 14, 132), 0.3, 5, 'ell'); s.lit((x - 3, 106, x + 3, 109), 0.5, 1, 'rect')


def _feature(s, cx, kind, glitch):
    if kind in (0, 2):                                         # узкое окно до пола подоконника, за ним город
        x0, x1, y0, y1 = cx - 9, cx + 9, 104, 168
        s.rect((x0 - 3, y0 - 3, x1 + 3, y1 + 3), '#eef3f2'); s.hd.rectangle((x0, y0, x1, y1), fill=255)
        s.rect((x0, 132, x1, 133), '#eef3f2'); s.hd.rectangle((x0, 132, x1, 133), fill=0)
        s.rect((x0 - 5, y1 + 3, x1 + 5, y1 + 5), '#f6f8f6')
        s.rect((x0 - 2, 178, x1 + 2, 188), '#e6edf0')            # батарея
        for x in range(x0, x1 + 2, 3):
            s.rect((x, 179, x, 187), '#b7c4cc')
        s.lit((x0 - 10, y0 - 8, x1 + 10, y1 + 8), 0.18, 6, 'rect')
        s.lit([(x0 + 4, BASE), (x1 + 4, BASE), (x1 + 40, H), (x0 + 40, H)], 0.42, 1.5, sun=True)
    elif kind == 1:                                            # картина: холмы и солнце
        s.rect((cx - 19, 106, cx + 19, 136), '#8c5f42'); s.rect((cx - 17, 108, cx + 17, 134), '#bfe0ee')
        s.ell((cx + 4, 112, cx + 12, 120), ACID if glitch else '#ffd66b')
        s.poly([(cx - 17, 126), (cx - 6, 120), (cx + 6, 127), (cx + 17, 124), (cx + 17, 134), (cx - 17, 134)], '#4c9c7c')
        s.poly([(cx - 17, 131), (cx + 2, 126), (cx + 17, 130), (cx + 17, 134), (cx - 17, 134)], '#2f7a63')
        s.rect((cx - 19, 106, cx + 19, 107), '#8c5f42'); s.rect((cx - 19, 135, cx + 19, 136), '#8c5f42')
        s.rect((cx - 20, 108, cx - 18, 136), '#8c5f42'); s.rect((cx + 18, 108, cx + 20, 136), '#8c5f42')
        s.rect((cx - 20, 137, cx + 20, 138), '#a3b4bd')
        s.rect((cx - 12, 176, cx + 12, 182), '#c79768'); s.rect((cx - 10, 183, cx - 9, 190), '#8c5f42'); s.rect((cx + 9, 183, cx + 10, 190), '#8c5f42')
        s.lit((cx - 16, 186, cx + 16, 194), -0.2, 2, 'rect')
    else:                                                      # стенд с объявлениями, огнетушитель
        s.rect((cx - 20, 104, cx + 20, 140), '#eef3f2'); s.rect((cx - 18, 106, cx + 18, 138), '#c79768')
        for i, (dx, dy, c) in enumerate(((-15, 109, '#ffffff'), (-3, 108, '#f0a830'), (8, 110, '#ffffff'),
                                         (-14, 124, '#6cc0c0'), (-2, 122, '#ffffff'), (9, 125, '#ef8a6a'))):
            s.rect((cx + dx, dy, cx + dx + 8, dy + 11), c); s.rect((cx + dx + 4, dy, cx + dx + 4, dy), ACID if glitch else '#b5651d')
            if c == '#ffffff':
                s.rect((cx + dx + 2, dy + 4, cx + dx + 6, dy + 4), '#9fb0ba'); s.rect((cx + dx + 2, dy + 7, cx + dx + 5, dy + 7), '#9fb0ba')
        s.rect((cx + 12, 162, cx + 17, 182), '#c94a3a'); s.rect((cx + 13, 158, cx + 16, 161), '#39415c')
        s.rect((cx + 13, 164, cx + 13, 178), '#e9806a'); s.rect((cx + 10, 166, cx + 11, 172), '#39415c')


def corridor(glitch=False):
    s = Scene(W + 2 * PAD, H, WALL, ambient=0.64)
    _shell(s, PAD, glitch)
    for i in range(-1, 5):
        bx = PAD + i * BAY + 10
        _door(s, bx + 10, i % 4, glitch); _sconce(s, bx + 54, glitch, i % 4); _feature(s, bx + 88, i % 4, glitch)
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.14, 3, 'rect')
    s.grade(0, 92, -0.06, 0.0); s.grade(BASE, H, -0.04, 0.1)
    return finish(s, glitch, match=None if glitch else office())


def _arrow(s, x, y, col):
    s.rect((x, y, x + 3, y), col); s.rect((x + 4, y - 2, x + 4, y + 2), col); s.rect((x + 5, y - 1, x + 5, y + 1), col); s.rect((x + 6, y, x + 6, y), col)


def arch():
    """Торец перегородки между опенспейсом и коридором: стык плиток прячется за ним. Строки 90..215 кадра."""
    w, h = ARCH
    s = Scene(w, h, '#dfe6e8', ambient=0.66)
    s.rect((0, 0, w, 6), '#8597a6'); s.rect((0, 7, w, 7), '#fff6dc')
    s.rect((0, 8, 4, h), '#a3b4bd'); s.rect((5, 8, 5, h), '#eef3f2')            # боковая грань в тени, ребро на свету
    s.rect((22, 8, 27, h), '#c79768'); s.rect((22, 8, 22, h), '#8c5f42')          # наличник проёма в коридор
    s.rect((8, 20, 19, 27), '#2f7a63'); s.rect((9, 21, 18, 26), '#4c9c7c')        # указатель «→»
    _arrow(s, 10, 23, '#f6f8f6')
    s.rect((7, 52, 20, 68), '#f6f8f6'); _arrow(s, 9, 56, '#39415c')                 # табличка: стрелка и номера
    for y, ln in ((61, 10), (64, 7)):
        s.rect((9, y, 9 + ln, y), '#9fb0ba')
    s.rect((21, 8, 21, h), '#8597a6')
    s.rect((7, 72, 10, 78), '#eef3f2'); s.rect((8, 74, 9, 75), '#9fb0ba')          # выключатель
    s.rect((0, h - 6, 21, h), '#6b7d94'); s.rect((0, h - 7, 21, h - 7), '#8597a6')  # плинтус торца
    s.grade(0, h, 0.04, -0.12); s.lit((0, 8, 5, h), -0.12, 0, 'rect'); s.lit((6, 8, 21, 102), 0.08, 3, 'rect')
    return s.render(colors=24)


def _room(s, glitch=False):
    """Кабинет за стеклом: тёплая стена, стеллаж, стол с лампой и монитором, начальница, растение."""
    x0, x1, y0, y1 = 52, 234, 101, 185
    s.rect((x0, y0, x1, 171), '#e6cfae'); s.rect((x0, 170, x1, 172), '#8c5f42'); s.rect((x0, 173, x1, y1), '#b07e58')
    for y in (176, 180):
        s.rect((x0, y, x1, y), '#9c6b4a')
    s.rect((58, 124, 92, 171), '#8c5f42'); s.rect((60, 126, 90, 169), '#5e3f30')     # стеллаж с папками
    for row, yb in enumerate((138, 153, 168)):
        s.rect((60, yb + 1, 90, yb + 2), '#8c5f42')
        for k in range(7):
            c = ('#f0a830', '#4b97a0', '#cf6f55', '#84568f', '#f4f6fa', '#4b97a0', '#f0a830')[(k + row * 3) % 7]
            hk = 10 + (k * 5 + row) % 3
            s.rect((61 + k * 4, yb - hk, 63 + k * 4, yb), c)
    s.rect((102, 116, 118, 136), '#8c5f42'); s.rect((104, 118, 116, 134), '#f6f1e6')   # диплом
    s.rect((106, 122, 114, 122), '#9fb0ba'); s.rect((107, 126, 113, 126), '#9fb0ba'); s.rect((109, 130, 111, 131), '#cf6f55')
    s.ell((150, 114, 160, 124), '#f6f1e6'); s.rect((155, 116, 155, 119), '#39415c'); s.rect((155, 119, 157, 119), '#39415c')    # часы
    s.rect((182, 152, 186, 172), '#39415c'); s.rect((180, 170, 194, 172), '#39415c')    # кресло
    s.rect((185, 173, 186, 181), '#39415c'); s.rect((179, 182, 192, 183), '#39415c')
    boss = cast()['boss_sit']
    s.img.paste(boss, (151, y1 - boss.height + 1), boss)
    s.rect((104, 160, 166, 162), '#e0b184'); s.rect((104, 163, 166, 164), '#a8754f')     # стол
    s.rect((106, 165, 124, 182), '#c79768'); s.rect((108, 172, 122, 172), '#a8754f'); s.rect((163, 165, 164, y1), '#8c5f42')
    s.rect((134, 156, 142, 159), '#39415c'); s.rect((137, 150, 139, 157), '#39415c')     # монитор к ней экраном
    s.rect((128, 134, 148, 150), '#2b3148'); s.rect((130, 136, 146, 148), '#ffd0ea' if glitch else '#bfe8f0')
    for i, ln in enumerate((10, 6, 12)):
        s.rect((132, 138 + i * 3, 132 + ln, 138 + i * 3), '#7fb4c4')
    s.rect((108, 158, 116, 159), '#39415c'); s.line([(112, 158), (108, 144), (114, 138)], '#39415c')  # лампа
    s.poly([(110, 136), (118, 136), (121, 142), (107, 142)], '#f0a830'); s.rect((109, 142, 119, 142), '#fff6dc')
    s.rect((150, 157, 154, 159), '#f6f8f6'); s.rect((119, 157, 126, 159), '#f4f6fa')     # кружка, бумаги
    _plant(s, 220, y1, big=True)
    s.lit((x0, y0, x1, y1), 0.16, 0, 'rect')
    s.lit((80, 126, 150, 182), 0.55, 10, 'ell'); s.lit((104, 143, 124, 160), 0.3, 3, 'ell')
    s.lit((96, 150, 170, 168), -0.12, 4, 'rect')


def boss_room():
    """Вставка 240x270 вместо стены коридора. Под дверь начальницы (wk_door, центр x=DOOR_X) — глухая стена 8..42."""
    s = Scene(ROOM_W, H, WALL, ambient=0.64)
    _shell(s, 0)
    s.rect((DOOR_X - 10, 140, DOOR_X + 10, 147), '#f0a830'); s.rect((DOOR_X - 8, 142, DOOR_X + 6, 142), '#7a4a3a')
    s.rect((DOOR_X - 8, 145, DOOR_X + 2, 145), '#b5651d')
    _sconce(s, DOOR_X, False, 0)
    _room(s)
    s.rect((50, 98, 236, 100), '#2b3148'); s.rect((50, 186, 236, BASE), '#2b3148')    # рама перегородки
    for x in (50, 96, 194, 235):
        s.rect((x, 98, x + 1, BASE), '#2b3148')
    s.rect((52, 101, 234, 110), '#efe6d6')                                            # жалюзи подняты
    for y in range(102, 111, 2):
        s.rect((52, y, 234, y), '#c9b8a0')
    for x in (70, 140, 214):
        s.rect((x, 111, x, 128), '#c9b8a0')
    for x in range(53, 234, 3):                                                      # матовая полоса на стекле
        s.rect((x, 146, x, 146), '#f6f8f6')
    for gx in (60, 120, 200):                                                         # блики на стекле
        s.lit([(gx, 112), (gx + 6, 112), (gx - 18, 184), (gx - 24, 184)], 0.16, 0.5)
    s.lit((48, BASE - 4, 238, BASE + 6), -0.2, 2, 'rect')
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.14, 3, 'rect')
    s.grade(0, 92, -0.06, 0.0); s.grade(BASE, H, -0.04, 0.1)
    return s.render(colors=60, match=corridor())
