"""Дорога до офиса: плитка улицы 480x270 (небо — прозрачные проёмы, за ними week_city) и квартира Саши 180x270.
Утро: солнце низко справа, тёплые стены, длинные тени по тротуару влево."""
from week_tone import Scene

W, H, FEET, BASE = 480, 270, 215, 192

def _tree(s, x):
    s.rect((x - 2, 150, x + 1, BASE + 6), '#6b4a44'); s.hd.rectangle((x - 2, 150, x + 1, BASE), fill=0)
    for dx, dy, r in ((0, -6, 17), (-13, 4, 12), (13, 2, 13), (-5, -20, 12), (8, -17, 11)):
        s.ell((x + dx - r, 128 + dy - r, x + dx + r, 128 + dy + r), '#3f8f6c'); s.hd.ellipse((x + dx - r, 128 + dy - r, x + dx + r, 128 + dy + r), fill=0)
    for dx, dy, r in ((4, -10, 11), (15, -2, 8), (10, -20, 7)):  # солнечная сторона
        s.ell((x + dx - r, 126 + dy - r, x + dx + r, 126 + dy + r), '#7cc084')
    s.lit([(x - 60, BASE + 26), (x - 4, BASE + 4), (x + 4, BASE + 8), (x - 40, BASE + 40)], -0.3, 2)

def _shop(s, x0, x1, wall, awn):
    s.rect((x0, 0, x1, BASE), wall); s.rect((x0, BASE - 5, x1, BASE), '#7d6a7c')
    for wx in range(x0 + 12, x1 - 26, 34):                      # окна второго этажа
        s.rect((wx, 52, wx + 20, 86), '#fff3dc'); s.rect((wx + 2, 54, wx + 18, 84), '#7fb6d6'); s.rect((wx + 2, 54, wx + 9, 70), '#b9e0f0')
        s.rect((wx - 2, 87, wx + 22, 88), '#fff3dc')
    s.rect((x0 + 8, 120, x1 - 44, 178), '#3a3458'); s.rect((x0 + 10, 122, x1 - 46, 176), '#8cc4dc')   # витрина
    s.poly([(x0 + 10, 122), (x0 + 40, 122), (x0 + 14, 176), (x0 + 10, 176)], '#c4e6f2')
    s.rect((x1 - 36, 126, x1 - 12, BASE), '#3a3458'); s.rect((x1 - 34, 128, x1 - 14, BASE - 1), '#c8674a'); s.rect((x1 - 31, 132, x1 - 17, 156), '#8cc4dc')
    for i, ax in enumerate(range(x0 + 4, x1 - 40, 8)):          # маркиза в полоску
        s.poly([(ax, 108), (ax + 8, 108), (ax + 6, 120), (ax - 2, 120)], awn if i % 2 else '#fff3dc')
    s.lit((x0 + 2, 120, x1 - 40, 130), -0.2, 2, 'rect')

def street():
    s = Scene(W, H, '#000000', ambient=0.66)
    s.hd.rectangle((0, 0, W, BASE), fill=255)
    for box in ((0, 0, 150, BASE), (236, 0, 404, BASE)):
        s.hd.rectangle(box, fill=0)
    _shop(s, 0, 150, '#e8927a', '#f0a830'); _shop(s, 236, 404, '#f3dcc0', '#4b97a0')
    s.rect((150, 0, 152, BASE), '#b9624f'); s.rect((404, 0, 406, BASE), '#c9b08f')
    for x0, x1 in ((152, 236), (406, 480)):                     # ограда сквера между домами
        s.hd.rectangle((x0, 164, x1, BASE), fill=0)
        s.rect((x0, 164, x1, BASE), '#4c9c7c'); s.rect((x0, 164, x1, 167), '#7cc084')
        for fx in range(x0 + 3, x1, 7):
            s.rect((fx, 170, fx + 1, BASE), '#3a3458')
        s.rect((x0, 174, x1, 175), '#3a3458')
    _tree(s, 196)
    s.rect((440, 96, 442, BASE + 4), '#3a3458'); s.rect((434, 92, 448, 96), '#3a3458'); s.rect((436, 96, 446, 98), '#fff3dc')   # фонарь
    s.hd.rectangle((434, 92, 448, 98), fill=0); s.hd.rectangle((440, 96, 442, BASE), fill=0)
    s.rect((0, BASE, W, 250), '#c9b9b4'); s.rect((0, 250, W, 254), '#efe4dc'); s.rect((0, 254, W, H), '#5a5674')
    for x in range(0, W, 48):                                   # плитка тротуара
        s.line([(x, BASE), (x - 30, 250)], '#b8a8a6')
    for y in (204, 226):
        s.rect((0, y, W, y), '#b8a8a6')
    for x in range(10, W, 60):
        s.rect((x, 262, x + 26, 263), '#efe4dc')
    for x0, x1 in ((152, 236), (406, 480)):                     # солнце между домами ложится на тротуар
        s.lit([(x0, BASE), (x1, BASE), (x1 - 70, 254), (x0 - 70, 254)], 0.4, 2)
    s.grade(0, BASE, 0.16, -0.04); s.lit((0, BASE - 4, W, BASE + 4), -0.12, 2, 'rect')
    return s.render(shadow='#9a86c8', sun='#fff0cc')

def home():
    s = Scene(180, H, '#eac6a4', ambient=0.6)
    s.rect((0, 0, 180, 60), '#f3d8ba'); s.rect((0, 60, 180, 61), '#c99a7c')
    s.rect((0, BASE - 4, 180, BASE), '#a8705a'); s.rect((0, BASE, 180, H), '#b9805c')
    for y in (203, 216, 232, 250):                              # доски пола
        s.rect((0, y, 180, y), '#a36c50')
    s.rect((0, 108, 60, 180), '#fff3dc'); s.hd.rectangle((4, 112, 56, 176), fill=255)       # окно
    s.rect((29, 112, 30, 176), '#fff3dc'); s.hd.rectangle((29, 112, 30, 176), fill=0)
    s.rect((0, 180, 66, 183), '#fff8ea'); s.rect((0, 184, 62, 184), '#c99a7c')              # подоконник Мистера
    s.poly([(56, 104), (70, 104), (72, 176), (60, 172), (58, 140)], '#e0785a')              # штора
    s.rect((0, 102, 74, 105), '#8a5a48')
    s.rect((84, 120, 132, 123), '#8a5a48')                                                  # полка с книгами
    for i, c in enumerate(('#4b97a0', '#f0a830', '#e0785a', '#84568f', '#4b97a0', '#fff3dc', '#e0785a')):
        s.rect((87 + i * 6, 106 + i % 3 * 2, 91 + i * 6, 119), c)
    s.rect((90, 136, 124, 162), '#fff3dc'); s.rect((92, 138, 122, 160), '#f0a830'); s.ell((100, 142, 114, 156), '#fff3dc')   # постер
    s.rect((78, 196, 142, 208), '#84568f'); s.rect((78, 190, 100, 198), '#fff3dc'); s.rect((76, 206, 144, 210), '#8a5a48')   # край кровати
    s.rect((146, 110, 176, BASE), '#8a5a48'); s.rect((149, 113, 176, BASE), '#fff0cc')      # дверь открыта на улицу
    s.hd.rectangle((149, 113, 176, BASE - 1), fill=255); s.rect((177, 0, 180, H), '#8a5a48')
    s.lit([(4, BASE), (56, BASE), (120, H), (50, H)], 0.5, 2); s.lit([(149, BASE), (180, BASE), (180, H), (120, H)], 0.4, 3)
    s.lit((-20, 96, 76, 190), 0.22, 10, 'rect'); s.lit((0, BASE - 4, 180, BASE + 4), -0.12, 2, 'rect')
    s.grade(0, 100, -0.1, 0.0)
    return s.render(shadow='#b07aa0', sun='#fff0cc', colors=48)
