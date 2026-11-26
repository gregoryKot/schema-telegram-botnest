"""Квартира друзей («Пятница»): плитка 480x270 с периодом по X, окно — проём в сумерки (week_city.city_eve).
Шалфейная стена над светлыми панелями, флажки и лампочки под потолком, стол с едой, колонка, шары.
Сбой — индиго: снимки на стенах стали масками, над проёмом горит выход, флажки кислотные."""
from PIL import Image
from week_tone import rgb
from week_office import W, H, BASE, PAD, ACID
from week_flat import Flat, _finish, _plant, _garland, _sofa, TRIM, DARKWOOD

WALL, PANEL, PANEL_LN, FLOOR, FLOOR_LN = '#6fb0a2', '#ead9c0', '#cdb898', '#b8875c', '#946641'
FLAGS = ('#e45a48', '#f0a830', '#2f9a6c', '#f4e8d4', '#4a74d6')
WIN, DOORWAY = (22, 102, 100, 162), (300, 110, 330)


def _shell(s, o):
    s.rect((o, 0, o + W, 86), '#566a70'); s.rect((o, 86, o + W, 89), TRIM)
    s.rect((o, 90, o + W, BASE), WALL)
    for cx, cy, r, col in ((150, 120, 26, '#8cc4b0'), (420, 118, 24, '#8cc4b0')):   # зайчики от гирлянды
        s.ell((cx + o - r, cy - r // 2, cx + o + r, cy + r // 2), col)
    s.rect((o, 152, o + W, BASE), PANEL); s.rect((o, 150, o + W, 152), TRIM)
    for x in range(o, o + W, 16):
        s.rect((x, 153, x, BASE - 6), PANEL_LN)
    s.rect((o, BASE - 5, o + W, BASE), TRIM); s.rect((o, BASE - 6, o + W, BASE - 6), '#a89070')
    s.rect((o, BASE, o + W, H), FLOOR)
    for y in (200, 210, 224, 242, 262):
        s.rect((o, y, o + W, y), FLOOR_LN)
    for k, (y0, y1) in enumerate(((200, 210), (210, 224), (224, 242), (242, 262), (262, H))):
        for x in range((k * 37) % 80, W, 80):
            s.rect((x + o, y0, x + o, y1), FLOOR_LN)
    s.poly([(130 + o, 205), (268 + o, 205), (278 + o, 216), (120 + o, 216)], '#2f6f78')    # ковёр под столом
    s.poly([(134 + o, 206), (264 + o, 206), (272 + o, 214), (126 + o, 214)], '#4b97a0')
    for x in range(138, 262, 10):
        s.rect((x + o, 209, x + o + 3, 211), '#f4e8d4')


def _window(s, o):
    x0, y0, x1, y1 = WIN[0] + o, WIN[1], WIN[2] + o, WIN[3]
    mx = (x0 + x1) // 2
    s.rect((x0 - 4, y0 - 4, x1 + 4, y1 + 4), TRIM); s.hd.rectangle((x0, y0, x1, y1), fill=255)
    for bx in (mx - 1, mx):
        s.rect((bx, y0, bx, y1), TRIM)
    s.hd.rectangle((mx - 1, y0, mx, y1), fill=0)
    s.rect((x0 - 8, y1 + 4, x1 + 8, y1 + 7), '#f6ecdc')
    for k, (bx, col) in enumerate(((x0 + 8, '#2f6a52'), (x0 + 20, '#c9785a'), (x1 - 16, '#2f6a52'))):   # бутылка, горшок, бутылка на подоконнике
        s.rect((bx, y1 - 8 - 4 * (k != 1), bx + 4, y1 + 3), col); s.hd.rectangle((bx, y1 - 8 - 4 * (k != 1), bx + 4, y1), fill=0)
    s.chill((x0 - 18, y0 - 14, x1 + 18, y1 + 16), 0.5, 10, 'rectangle')
    s.chill([(x0, BASE), (x1, BASE), (x1 - 24, H), (x0 - 40, H)], 0.6, 4)


def _bunting(s, o):
    """Флажки под потолком: шнур провисает между крючками; в сбое каждый второй — кислотный."""
    for x0 in range(0, W, 160):
        pts = [(x0 + o + dx, 91 + round(9 * (1 - ((dx - 80) / 80) ** 2))) for dx in range(0, 161, 4)]
        s.line(pts, '#3a2a2a')
        for k, (x, y) in enumerate(pts[2:-2:4]):
            tri = [(x - 5, y), (x + 5, y), (x, y + 10)]
            if s.glitch and k % 2:
                s.acid(tri, kind='polygon')
            else:
                s.poly(tri, FLAGS[(k + x0 // 160) % len(FLAGS)])


def _balloons(s, o):
    for cx, cy, col, hi in ((122, 112, '#e45a48', '#ff9a80'), (136, 100, '#f0a830', '#ffd66b'), (146, 118, '#f4e8d4', '#ffffff')):
        s.line([(cx + o, cy + 10), (132 + o, 150)], '#5a4a4a')
        s.ell((cx + o - 9, cy - 11, cx + o + 9, cy + 11), col); s.ell((cx + o - 5, cy - 8, cx + o - 1, cy - 3), hi)
        s.poly([(cx + o - 2, cy + 11), (cx + o + 2, cy + 11), (cx + o, cy + 14)], col)
    s.lit((110 + o, 90, 160 + o, 132), 0.16, 6, 'ell')


def _table(s, o):
    """Стол с едой: скатерть, бутылки, стаканчики, миска, коробка пиццы, пустая подставка — торт уже несут."""
    x0, x1 = 150 + o, 250 + o
    s.rect((x0, 172, x1, 176), '#fff6e6'); s.rect((x0 + 2, 177, x1 - 2, 196), '#f4e8d4')
    for x in range(x0 + 2, x1 - 2, 8):                          # фестоны скатерти
        s.ell((x, 192, x + 8, 200), '#f4e8d4')
    for x in range(x0 + 6, x1 - 4, 12):
        s.rect((x, 180, x + 1, 190), '#e45a48')
    s.rect((x0 + 6, 197, x0 + 8, 204), DARKWOOD); s.rect((x1 - 8, 197, x1 - 6, 204), DARKWOOD)
    for bx, col, hgt in ((x0 + 8, '#2f6a52', 20), (x0 + 15, '#b5651d', 17), (x0 + 22, '#2f6a52', 22)):
        s.rect((bx, 172 - hgt + 6, bx + 4, 171), col); s.rect((bx + 1, 172 - hgt, bx + 3, 172 - hgt + 6), col)
        s.rect((bx, 172 - hgt + 10, bx + 4, 172 - hgt + 13), '#f4e8d4')
    for k in range(4):                                          # стаканчики
        cx = x0 + 34 + k * 7
        s.poly([(cx, 164), (cx + 5, 164), (cx + 4, 171), (cx + 1, 171)], '#e45a48' if k % 2 else '#4a74d6'); s.rect((cx, 164, cx + 5, 164), '#ffffff')
    s.d.chord((x0 + 62, 158, x0 + 80, 176), 0, 180, fill=rgb('#2f8088'))   # миска с чипсами
    for dx in (0, 4, 8, 12):
        s.poly([(x0 + 64 + dx, 166), (x0 + 68 + dx, 166), (x0 + 66 + dx, 161)], '#f0a830')
    s.rect((x0 + 83, 165, x0 + 99, 171), '#c9a070'); s.rect((x0 + 83, 165, x0 + 99, 166), '#e0b888')   # коробка пиццы
    s.lit((x0 - 6, 150, x1 + 6, 182), 0.22, 7, 'ell', sun=True)
    s.lit((x0, 198, x1, 206), -0.16, 3, 'rect')


def _speaker(s, o):
    x = 264 + o
    s.rect((x, 150, x + 22, 202), '#2a2438'); s.rect((x + 1, 151, x + 21, 152), '#4a4460')
    for cy, r in ((163, 5), (185, 8)):
        s.ell((x + 11 - r, cy - r, x + 11 + r, cy + r), '#15121f'); s.ell((x + 11 - r // 2, cy - r // 2, x + 11 + r // 2, cy + r // 2), '#5a5078')
    for k, (dx, dy) in enumerate(((28, -8), (33, -20), (26, -30))):   # ноты над колонкой
        s.rect((x + dx, 150 + dy, x + dx, 156 + dy), '#3a2a2a'); s.ell((x + dx - 3, 155 + dy, x + dx, 158 + dy), '#3a2a2a')
        if k != 1:
            s.rect((x + dx, 150 + dy, x + dx + 3, 151 + dy), '#3a2a2a')
    s.lit((x, 196, x + 22, 206), -0.16, 3, 'rect')


def _doorway(s, o):
    """Проём в прихожую с вешалкой. В сбое — выход: проём светится, над ним табличка со стрелкой назад."""
    x0, y0, x1 = DOORWAY[0] + o, DOORWAY[1], DOORWAY[2] + o
    s.rect((x0 - 4, y0 - 4, x1 + 4, BASE), TRIM); s.rect((x0, y0, x1, BASE), '#3f4a52')
    if s.glitch:
        s.acid((x0 + 3, y0 + 4, x1 - 3, BASE - 2))
        ay = y0 + 30                                            # стрелка назад во весь проём: выход там, откуда пришли
        s.acid([(x0 + 6, ay), (x0 + 15, ay - 9), (x0 + 15, ay - 4), (x1 - 6, ay - 4), (x1 - 6, ay + 4), (x0 + 15, ay + 4), (x0 + 15, ay + 9)], '#2a2140', 'polygon')
        return
    s.rect((x0, y0, x1, y0 + 6), '#566a70')
    for k, col in enumerate(('#e45a48', '#4a74d6', '#f0a830')):  # куртки гостей на крючках
        cx = x0 + 3 + k * 9
        s.poly([(cx, y0 + 12), (cx + 7, y0 + 12), (cx + 8, y0 + 44 + k * 3), (cx - 1, y0 + 44 + k * 3)], col); s.rect((cx + 3, y0 + 9, cx + 4, y0 + 12), '#2a2438')
    s.rect((x0 + 2, BASE - 5, x1 - 2, BASE), '#7a5248')
    s.lit((x0, y0, x1, BASE), -0.14, 2, 'rect')


def _wall_art(s, o):
    """Над диваном: снимки на прищепках; в сбое на их месте маски — белые лица с одинаковой улыбкой."""
    spots = ((372, 112), (392, 118), (412, 112), (432, 118), (452, 113), (176, 116), (204, 110), (232, 117))
    if not s.glitch:
        s.line([(366 + o, 108), (462 + o, 110)], '#5a4a4a'); s.line([(170 + o, 110), (242 + o, 108)], '#5a4a4a')
    for k, (x, y) in enumerate(spots):
        if s.glitch:
            box = (x + o - 1, y - 1, x + o + 11, y + 13)
            s.acid(box, '#ece8f4', 'ellipse')
            for ex in (x + o + 2, x + o + 7):
                s.acid((ex, y + 4, ex + 1, y + 5), '#231a36')
            s.acid([(x + o + 2, y + 8), (x + o + 4, y + 10), (x + o + 6, y + 10), (x + o + 8, y + 8)], kind='line')
            continue
        s.rect((x + o, y, x + o + 10, y + 13), '#fff6e6'); s.rect((x + o + 1, y + 1, x + o + 9, y + 9), ('#e8b878', '#7f9ea8', '#d98a7a', '#9cb89e')[k % 4])
        s.rect((x + o + 4, y - 2, x + o + 5, y + 1), '#e45a48')


def party(glitch=False):
    s = Flat(glitch)
    for o in (PAD - W, PAD, PAD + W):
        _shell(s, o)
    for o in (PAD - W, PAD, PAD + W):
        _window(s, o); _balloons(s, o); _table(s, o); _speaker(s, o); _doorway(s, o); _wall_art(s, o)
        _plant(s, 344 + o); _sofa(s, o + 228); _garland(s, o); _bunting(s, o)
    s.light += 0.2                                              # вечеринка светлее вечера «Среды»: горит всё
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.14, 3, 'rect')
    s.grade(0, 92, -0.14, 0.0); s.grade(BASE, H, -0.02, 0.06)
    return _finish(s)


def exit_floor():
    """Пол в сбое едет к выходу: шевроны смотрят назад, полоса 480x48 кладётся на пол ниже строки стоп и течёт."""
    img = Image.new('RGBA', (W, 48), (0, 0, 0, 0)); px = img.load()
    for y0, size, step, col in ((2, 6, 40, (103, 83, 184, 255)), (22, 10, 60, (255, 62, 165, 255))):
        for x0 in range(0, W, step):
            for j in range(-size, size + 1):
                for t in range(size // 2 + 1):
                    x, y = x0 + abs(j) + t, y0 + size + j
                    if y < 48:
                        px[x % W, y] = col
    return img
