"""Вечерняя квартира Саши («Среда»): плитка 480x270 с периодом по X, окна — прозрачные проёмы в сумерки
(за ними едет week_city.city_eve). Свет — тёплые лампы против синих окон. Сбой — индиго, окна становятся
экранами звонка, на стенах пузыри реплик, дверной проём уходит в бесконечность."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from week_tone import Scene, duotone, rgb
from week_office import W, H, BASE, PAD, ACID, GLITCH_RAMP, warp, tear

WALL, STRIPE, KITCHEN, TRIM, WOOD, DARKWOOD = '#c99a84', '#bf8f7a', '#d9c3a2', '#efe2d0', '#a8704e', '#6a4434'
SOFA, SOFA_HI, SAGE, SAGE_HI = '#4f7d78', '#6a9a92', '#7f9c84', '#9cb89e'
WIN_A, WIN_B, DOORWAY = (24, 104, 96, 166), (402, 108, 446, 158), (318, 112, 344)


class Flat(Scene):
    """Сцена с картой холодного света окон и маской «не красить в сбое» (кислотные детали)."""
    def __init__(self, glitch):
        super().__init__(W + 2 * PAD, H, WALL, ambient=0.36)
        self.glitch = glitch
        self.cool = Image.new('L', (self.w, self.h), 0); self.keep = Image.new('L', (self.w, self.h), 0)

    def chill(self, shape, amount, blur, kind='polygon'):
        m = Image.new('L', (self.w, self.h), 0); getattr(ImageDraw.Draw(m), kind)(shape, fill=int(255 * amount))
        self.cool = Image.fromarray(np.maximum(np.asarray(self.cool), np.asarray(m.filter(ImageFilter.GaussianBlur(blur)))))

    def acid(self, box, col=ACID, kind='rectangle', **kw):
        """Деталь сбоя, которую duotone не трогает: кислотный розовый, бумага пузырей."""
        getattr(self.d, kind)(box, fill=rgb(col), **kw); getattr(ImageDraw.Draw(self.keep), kind)(box, fill=255, **kw)


def _window(s, o, box, curtains):
    x0, y0, x1, y1 = box[0] + o, box[1], box[2] + o, box[3]
    mx = (x0 + x1) // 2
    if s.glitch:                                                # окно стало экраном звонка: корпус, «чёлка», кнопки
        s.d.rounded_rectangle((x0 - 6, y0 - 8, x1 + 6, y1 + 8), 7, fill=rgb('#2a2140'))
        s.hd.rounded_rectangle((x0, y0, x1, y1), 3, fill=255)
        s.rect((mx - 9, y0 - 5, mx + 9, y0 - 3), '#120c26'); s.hd.rectangle((mx - 9, y0, mx + 9, y0 + 2), fill=0)
        s.rect((mx - 9, y0, mx + 9, y0 + 2), '#2a2140')
        r = min(12, (x1 - x0) // 5)
        for k, col in ((-1, '#5a5078'), (0, ACID), (1, '#5a5078')):
            cx = mx + k * (r * 2 + 4); cy = y1 - r - 4
            s.hd.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), fill=0)
            if col == ACID:
                s.acid((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), kind='ellipse')
            else:
                s.ell((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), col)
        ay = y0 + (y1 - y0) // 3                                # аватар мамы: пучок и пустой овал вместо лица
        s.hd.ellipse((mx - 9, ay - 9, mx + 9, ay + 9), fill=0); s.ell((mx - 9, ay - 9, mx + 9, ay + 9), '#6753b8')
        s.hd.ellipse((mx - 4, ay - 14, mx + 4, ay - 7), fill=0); s.ell((mx - 4, ay - 14, mx + 4, ay - 7), '#6753b8')
        s.acid((mx - 5, ay - 5, mx + 5, ay + 7), '#ece8f4', 'ellipse')
        return
    s.rect((x0 - 4, y0 - 4, x1 + 4, y1 + 4), TRIM); s.hd.rectangle((x0, y0, x1, y1), fill=255)
    s.rect((mx - 1, y0, mx, y1), TRIM); s.hd.rectangle((mx - 1, y0, mx, y1), fill=0)
    s.rect((x0, y0 + 22, x1, y0 + 23), TRIM); s.hd.rectangle((x0, y0 + 22, x1, y0 + 23), fill=0)
    s.rect((x0 - 8, y1 + 4, x1 + 8, y1 + 7), '#f6ecdc'); s.rect((x0 - 6, y1 + 8, x1 + 6, y1 + 8), '#9a7a6a')
    if curtains:
        s.rect((x0 - 20, y0 - 10, x1 + 20, y0 - 9), DARKWOOD)
        for cx, d in ((x0 - 16, 1), (x1 + 4, -1)):              # шторы собраны по бокам, складки
            s.poly([(cx, y0 - 8), (cx + 12, y0 - 8), (cx + 12 + 3 * d, y1 + 30), (cx - 2 + 3 * d, y1 + 30)], '#3f6a7a')
            for fx in (cx + 3, cx + 8):
                s.line([(fx, y0 - 8), (fx + 3 * d, y1 + 30)], '#2f5262')
    # сумерки из окна: холодный свет на откос, подоконник и пол
    s.chill((x0 - 18, y0 - 14, x1 + 18, y1 + 16), 0.55, 10, 'rectangle')
    s.chill([(x0, BASE), (x1, BASE), (x1 - 24, H), (x0 - 40, H)], 0.7, 4)


def _lamp(s, o):
    """Торшер у дивана: абажур, тёплый круг на стене и пятно на полу."""
    x = 124 + o
    s.ell((x - 9, 198, x + 9, 203), '#3a2a2a'); s.rect((x - 1, 116, x, 200), '#3a2a2a')
    s.poly([(x - 8, 102), (x + 7, 102), (x + 11, 117), (x - 12, 117)], '#f4c27a')
    s.rect((x - 12, 117, x + 11, 118), '#ffe2a8')
    s.lit((x - 60, 60, x + 60, 170), 0.5, 16, 'ell', sun=True)
    s.lit([(x - 10, 118), (x + 9, 118), (x + 46, BASE), (x - 48, BASE)], 0.2, 6)
    s.lit((x - 70, 190, x + 66, 232), 0.34, 9, 'ell', sun=True)
    s.lit((x - 8, 103, x + 7, 117), 0.7, 1, 'rect')


def _sofa(s, o):
    x0, x1 = 138 + o, 238 + o
    s.d.rounded_rectangle((x0 + 6, 154, x1 - 6, 184), 5, fill=rgb(SOFA))
    s.rect((x0 + 8, 156, x1 - 8, 157), SOFA_HI)
    s.d.rounded_rectangle((x0, 168, x0 + 12, 198), 4, fill=rgb(SOFA)); s.d.rounded_rectangle((x1 - 12, 168, x1, 198), 4, fill=rgb(SOFA))
    s.rect((x0 + 12, 182, x1 - 12, 196), SOFA_HI); s.rect((x0 + 12, 186, x1 - 12, 186), SOFA)
    s.rect((x0 + 2, 199, x0 + 4, 203), DARKWOOD); s.rect((x1 - 4, 199, x1 - 2, 203), DARKWOOD)
    s.d.rounded_rectangle((x0 + 16, 166, x0 + 32, 182), 3, fill=rgb('#c96a4a'))     # подушки
    s.d.rounded_rectangle((x0 + 34, 168, x0 + 48, 182), 3, fill=rgb('#d8a040'))
    s.poly([(x1 - 22, 160), (x1 - 4, 166), (x1 - 2, 196), (x1 - 16, 194)], '#efe0c6')   # плед на подлокотнике
    for y in (170, 178, 186):
        s.line([(x1 - 18, y), (x1 - 4, y + 2)], '#d8c6a8')
    s.lit((x0 - 4, 196, x1 + 6, 206), -0.18, 3, 'rect')


def _frames(s, o):
    if s.glitch:
        return
    for x, y, w, h, pic in ((156, 122, 16, 20, '#e8b878'), (178, 116, 26, 30, '#d9a87a'), (210, 126, 14, 16, '#9cb89e')):
        s.rect((x + o, y, x + o + w, y + h), DARKWOOD); s.rect((x + o + 2, y + 2, x + o + w - 2, y + h - 2), pic)
    s.ell((183 + o, 124, 191 + o, 134), '#7a5048'); s.ell((193 + o, 128, 199 + o, 136), '#7a5048')   # фото: мама и ребёнок
    s.rect((182 + o, 134, 192 + o, 144), '#a8604a'); s.rect((192 + o, 136, 200 + o, 144), '#4f7d78')
    s.ell((185 + o, 120, 189 + o, 124), '#9a9098')


def _bubbles(s, o):
    """Сбой: фото на стенах стали репликами мамы — пузыри входящих сообщений."""
    for x, y, w, pink in ((150, 110, 40, 1), (198, 122, 34, 0), (160, 136, 44, 1), (298, 124, 22, 0), (358, 108, 36, 1), (448, 128, 28, 0)):
        col = '#e8a0c8' if pink else '#f4f0fa'                  # сами пузыри — в индиго сбоя, кислотные только строки
        s.d.rounded_rectangle((x + o, y, x + o + w, y + 10), 3, fill=rgb(col))
        s.poly([(x + o + 3, y + 10), (x + o + 9, y + 10), (x + o + 1, y + 14)], col)
        for j, ln in enumerate((w - 10, w - 18)):
            box = (x + o + 4, y + 3 + j * 4, x + o + 4 + ln, y + 3 + j * 4)
            s.acid(box) if pink else s.rect(box, '#5b6382')

def _shelf(s, o):
    x0, x1 = 252 + o, 294 + o
    s.rect((x0, 100, x1, 202), DARKWOOD); s.rect((x0 + 3, 103, x1 - 3, 200), '#4a2e28')
    books = ('#c96a4a', '#d8a040', '#4f7d78', '#efe0c6', '#8a5a7a', '#5a7aa0', '#c96a4a', '#7f9c84')
    for row, yb in enumerate((124, 148, 172, 197)):
        s.rect((x0 + 3, yb + 1, x1 - 3, yb + 3), DARKWOOD)
        bx, i = x0 + 4, row * 3
        while bx < x1 - 6:
            i += 1; w = 3 + (i * 7) % 3; hgt = 14 + (i * 5) % 7
            if (i + row) % 6 == 0:                              # просвет: ваза или стопка лёжа
                s.rect((bx + 1, yb - 4, bx + 9, yb), books[(i + 2) % 8]); s.rect((bx + 2, yb - 7, bx + 8, yb - 5), books[(i + 4) % 8]); bx += 11; continue
            s.rect((bx, yb - hgt, bx + w - 1, yb), books[i % 8]); bx += w + (i % 4 == 0)
    for dx, dy in ((0, 0), (5, 3), (10, 1), (-3, 6), (14, 6)):  # плющ свешивается с полки
        s.ell((x0 + 6 + dx, 92 + dy, x0 + 12 + dx, 98 + dy), '#4c8c6a')
    for k, (vx, ln) in enumerate(((x0 + 8, 30), (x0 + 20, 44), (x1 - 6, 22))):
        for j in range(0, ln, 5):
            s.ell((vx - 2 + (j // 5) % 2 * 2, 100 + j, vx + 2 + (j // 5) % 2 * 2, 104 + j), '#3f7a5c' if (j + k) % 2 else '#5a9c74')
    s.lit((x0, 103, x1, 200), -0.1, 2, 'rect')


def _plant(s, x):
    s.poly([(x - 8, 186), (x + 8, 186), (x + 6, 202), (x - 6, 202)], '#c9785a'); s.rect((x - 9, 185, x + 9, 187), '#e09070')
    for dx, dy, r in ((0, -24, 9), (-10, -16, 8), (10, -18, 8), (-4, -36, 7), (7, -32, 7), (-12, -30, 6)):
        s.ell((x + dx - r, 186 + dy - r, x + dx + r, 186 + dy + r), '#2f6a52')
        s.ell((x + dx - r + 2, 186 + dy - r + 1, x + dx + 1, 186 + dy), '#4c8c6a')
        s.line([(x + dx - r // 2, 186 + dy), (x + dx + r // 2, 186 + dy - 2)], '#1f4a3a')


def _doorway(s, o):
    """Проём в прихожую. В сбое — бесконечная анфилада проёмов: квартира тянется в лабиринт."""
    x0, y0, x1 = DOORWAY[0] + o, DOORWAY[1], DOORWAY[2] + o
    s.rect((x0 - 4, y0 - 4, x1 + 4, BASE), TRIM); s.rect((x0, y0, x1, BASE), '#5a3c40')
    if s.glitch:
        for k in range(1, 5):                                   # проёмы друг в друге, всё глубже
            box = (x0 + k * 3, y0 + k * 9, x1 - k * 3, BASE - k * 2)
            s.rect(box, TRIM); s.rect((box[0] + 1, box[1] + 1, box[2] - 1, box[3]), '#3a2430')
        s.acid((x0 + 12, y0 + 46, x1 - 12, BASE - 9))
        return
    s.rect((x0, y0, x1, y0 + 30), '#6a4a4a'); s.rect((x0 + 4, BASE - 12, x1 - 4, BASE), '#7a5248')   # дальняя стена, коврик
    s.rect((x0 + 6, y0 + 14, x0 + 8, y0 + 16), '#3a2a2a'); s.poly([(x0 + 5, y0 + 16), (x0 + 12, y0 + 16), (x0 + 13, y0 + 48), (x0 + 3, y0 + 48)], '#5a7aa0')
    s.lit((x0, y0, x1, BASE), -0.12, 2, 'rect'); s.lit((x1 - 10, y0 + 6, x1 + 10, y0 + 40), 0.25, 6, 'ell')


def _kitchen(s, o):
    x0, x1 = 354 + o, 474 + o
    s.rect((x0, 92, x1, BASE), KITCHEN)
    for y in range(138, 170, 6):                                # фартук: плитка-кабанчик
        s.rect((x0, y, x1, y), '#c9b494')
        for x in range(x0 + (y // 6 % 2) * 6, x1, 12):
            s.rect((x, y, x, y + 5), '#c9b494')
    s.rect((x0, 102, x0 + 42, 134), SAGE); s.rect((x0 + 1, 103, x0 + 41, 104), SAGE_HI)    # верхний шкаф
    s.rect((x0 + 21, 104, x0 + 21, 134), '#6a8a70'); s.rect((x0 + 18, 128, x0 + 19, 131), '#d8b070'); s.rect((x0 + 23, 128, x0 + 24, 131), '#d8b070')
    s.rect((x1 - 20, 118, x1, 120), DARKWOOD)                   # полочка с банками
    for k, c in enumerate(('#d8a040', '#efe0c6', '#c96a4a')):
        s.rect((x1 - 19 + k * 6, 110, x1 - 15 + k * 6, 117), c)
    s.rect((x0 - 2, 168, x1 + 2, 172), '#e6d6bc'); s.rect((x0 - 2, 172, x1 + 2, 173), '#a88a6a')    # столешница
    s.rect((x0, 174, x1, 200), SAGE)
    for x in range(x0, x1, 30):
        s.rect((x, 174, x, 200), '#6a8a70'); s.rect((x + 13, 178, x + 17, 179), '#d8b070')
    s.rect((x0, 200, x1, 202), '#3a2a2a')
    kx = x0 + 18                                                # чайник, кружки, доска
    s.d.rounded_rectangle((kx - 7, 155, kx + 7, 168), 4, fill=rgb('#d0573f')); s.rect((kx - 3, 152, kx + 3, 155), '#3a2a2a')
    s.line([(kx + 7, 160), (kx + 12, 156)], '#d0573f', 2); s.line([(kx - 7, 158), (kx - 10, 162), (kx - 7, 166)], '#3a2a2a')
    s.rect((kx - 4, 159, kx - 2, 162), '#f08a6a')
    if not s.glitch:                                            # пар над чайником
        for k, (dx, dy) in enumerate(((0, -6), (1, -9), (0, -12), (-1, -15), (0, -18))):
            s.rect((kx + 9 + dx, 156 + dy, kx + 9 + dx, 157 + dy), '#f6ecdc' if k < 3 else '#e0cdb8')
    for mx, c in ((x0 + 34, '#efe0c6'), (x0 + 42, '#4f7d78')):
        s.rect((mx, 162, mx + 5, 168), c); s.line([(mx + 6, 163), (mx + 7, 165), (mx + 6, 167)], c)
    s.d.rounded_rectangle((x1 - 26, 152, x1 - 12, 168), 2, fill=rgb('#c08a5a')); s.ell((x1 - 21, 155, x1 - 17, 159), '#a8704e')
    _window(s, o, WIN_B, False)
    px = (WIN_B[0] + WIN_B[2]) // 2 + o                         # подвесной светильник над столешницей
    if not s.glitch:                                            # в сбое светильник съеден экраном, свет остался
        s.rect((px, 0, px, 120), '#3a2a2a'); s.hd.rectangle((px, 0, px, 120), fill=0)
        s.d.chord((px - 9, 118, px + 9, 134), 180, 360, fill=rgb('#d8a040')); s.hd.rectangle((px - 9, 118, px + 9, 126), fill=0)
        s.rect((px - 9, 126, px + 9, 126), '#ffe2a8'); s.hd.rectangle((px - 9, 126, px + 9, 126), fill=0)
    s.lit([(px - 9, 127), (px + 9, 127), (px + 38, 172), (px - 38, 172)], 0.3, 5, sun=True)
    s.lit((px - 44, 160, px + 44, 180), 0.25, 5, 'ell', sun=True); s.lit((px - 30, 112, px + 30, 140), 0.4, 8, 'ell')
    s.lit((x0, 174, x1, 202), -0.14, 2, 'rect')


def _garland(s, o):
    """Гирлянда под карнизом: провод провисает между крючками, лампочки — тёплые точки (в сбое — кислотные)."""
    pts = [(x + o, 92 + round(7 * (1 - ((x % 120 - 60) / 60) ** 2))) for x in range(0, W + 1)]
    s.line(pts, '#3a2a2a')
    for x, y in pts[6::12]:
        if s.glitch:
            s.acid((x - 1, y + 1, x, y + 3))
        else:
            s.rect((x - 1, y + 1, x, y + 3), '#ffd27a'); s.lit((x - 6, y - 4, x + 6, y + 8), 0.3, 2, 'ell', sun=True)


def _shell(s, o):
    s.rect((o, 0, o + W, 86), '#8a6a6a'); s.rect((o, 86, o + W, 89), TRIM)
    for x in range(o, o + 350, 8):                              # обои в тонкую полоску
        s.rect((x, 90, x, BASE), STRIPE)
    s.rect((o, BASE - 5, o + W, BASE), '#efe2d0'); s.rect((o, BASE - 6, o + W, BASE - 6), '#b88a76')
    s.rect((o, BASE, o + W, H), '#9a6448')
    for y in (200, 210, 224, 242, 262):                         # доски пола, стыки вразбежку
        s.rect((o, y, o + W, y), '#7e4e3a')
    for k, (y0, y1) in enumerate(((200, 210), (210, 224), (224, 242), (242, 262), (262, H))):
        for x in range((k * 53) % 90, W, 90):
            s.rect((x + o, y0, x + o, y1), '#7e4e3a')
    s.poly([(118 + o, 204), (258 + o, 204), (266 + o, 214), (110 + o, 214)], '#8a3e44')   # ковёр у дивана
    s.poly([(121 + o, 205), (255 + o, 205), (261 + o, 212), (115 + o, 212)], '#b0585a')
    for x in range(126, 252, 12):
        s.rect((x + o, 207, x + o + 4, 209), '#e0b080')


def flat(glitch=False):
    s = Flat(glitch)
    for o in (PAD - W, PAD, PAD + W):
        _shell(s, o)
    for o in (PAD - W, PAD, PAD + W):
        _window(s, o, WIN_A, True); _lamp(s, o); _sofa(s, o); _frames(s, o); _shelf(s, o)
        _plant(s, 306 + o); _doorway(s, o); _kitchen(s, o); _garland(s, o)
        s.rect((4 + o, 112, 12 + o, 128), '#efe0c6'); s.rect((5 + o, 113, 11 + o, 115), '#c96a4a')  # календарь
        if glitch:
            _bubbles(s, o)
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.14, 3, 'rect')
    s.grade(0, 92, -0.12, 0.0); s.grade(BASE, H, -0.02, 0.06)
    return _finish(s)


def _finish(s):
    """Как week_office.finish, но холод окон и детали сбоя, которые duotone не красит."""
    cool = np.asarray(s.cool, np.float32)[..., None] / 255
    a = np.asarray(s.img, np.float32); grey = a.mean(2, keepdims=True)
    s.img.paste(Image.fromarray(np.clip(a * (1 - cool * 0.6) + grey * np.array([0.62, 0.72, 1.25]) * cool * 0.6, 0, 255).astype(np.uint8)))
    s.light += cool[..., 0] * 0.12
    if not s.glitch:
        img = s.render(shadow='#4a3c86', sun='#ffc890', colors=54)
        return img.crop((PAD, 0, PAD + W, H))
    tone, raw, keep = duotone(GLITCH_RAMP), np.asarray(s.img, np.float32), np.asarray(s.keep)[..., None] > 0
    glow = np.asarray(s.hole.filter(ImageFilter.GaussianBlur(8)), np.float32)[..., None] / 255 * 0.85
    glow = np.maximum(glow, np.asarray(s.sun, np.float32)[..., None] / 255 * 0.3)
    post = lambda a: np.where(keep, raw, tone(np.clip(a * 1.7, 0, 255)) * (1 - glow) + np.array(rgb(ACID), np.float32) * glow)
    img = s.render(post=post, colors=44).crop((PAD, 0, PAD + W, H))
    return tear(warp(img))
