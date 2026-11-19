"""Город за окнами и над улицей: утреннее небо и три гряды домов в дымке. Плитка 480x200, едет медленнее мира."""
from week_tone import Scene

W, H = 480, 200

def _row(s, base_y, seed, col, lit, hmin, hmax, step):
    x = -(seed * 7) % step
    i = seed
    while x < W:
        i = (i * 1103515245 + 12345) & 0x7fffffff
        w, h = step - 4 + i % 9, hmin + (i >> 4) % (hmax - hmin)
        for ox in (0, W):                                       # вылет вправо заворачивается в начало
            s.rect((x - ox, base_y - h, x - ox + w, H), col)
            if (i >> 9) % 3 == 0:
                s.rect((x - ox + w // 2 - 1, base_y - h - 6, x - ox + w // 2, base_y - h), col)
            for wy in range(base_y - h + 4, base_y - 2, 5):
                for wx in range(x - ox + 3, x - ox + w - 2, 4):
                    if (wx * 7 + wy * 13 + i) % 5 < 2:
                        s.rect((wx, wy, wx, wy + 1), lit)
        x += w + 2 + (i >> 7) % 6

def city():
    s = Scene(W, H, '#a9d3ea', ambient=0.8)
    for y in range(H):                                          # небо: голубое вверху, персиковое у горизонта
        t = min(1.0, y / 150) ** 1.4
        s.rect((0, y, W, y), '#%02x%02x%02x' % (int(150 + 105 * t), int(205 + 30 * t), int(238 - 28 * t)))
    for cx, cy, w in ((60, 46, 70), (250, 28, 96), (400, 60, 60)):   # облака-полосы
        for ox in (0, W, -W):
            s.ell((cx - w // 2 + ox, cy, cx + w // 2 + ox, cy + 7), '#ffffff'); s.ell((cx - w // 3 + ox, cy - 4, cx + w // 4 + ox, cy + 5), '#ffffff')
    _row(s, 150, 3, '#d3e0ee', '#e4edf6', 30, 80, 26)
    _row(s, 165, 11, '#b4c8e0', '#d0deee', 30, 70, 30)
    _row(s, 185, 29, '#93aacd', '#ffe9b8', 24, 56, 36)
    s.lit((140, 60, 420, 230), 0.25, 30, 'ell')                 # солнце за домами
    return s.render(colors=40, amp=10)
