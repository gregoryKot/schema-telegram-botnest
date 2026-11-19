"""Опенспейс «Понедельника»: плитка 480x270 с периодом по горизонтали, окна — прозрачные проёмы
(за ними едет город, week_city). Стопы в проходе — на строке FEET; на телефоне виден низ кадра от строки 90.
Спокойный офис — холодная стена и тёплые пятна солнца на полу; сбой — тот же кадр в индиго с кислотным розовым."""
import math
import numpy as np
from PIL import Image, ImageFilter
from week_tone import Scene, duotone, rgb
from week_cast import cast

W, H, FEET, BASE, BAY, PAD = 480, 270, 215, 192, 160, 80
ACID = '#ff3ea5'
WIN = (10, 98, 128, 168)                  # окно в пролёте: x0, y0, x1, y1
GLITCH_RAMP = ('#0b0820', '#150f36', '#241a54', '#3b2d80', '#6753b8', '#b8a6ff')

def _window(s, bx):
    x0, y0, x1, y1 = WIN[0] + bx, WIN[1], WIN[2] + bx, WIN[3]
    s.rect((x0 - 3, y0 - 3, x1 + 3, y1 + 3), '#eef3f2')
    s.hd.rectangle((x0, y0, x1, y1), fill=255)
    for mx in (x0 + 39, x0 + 78):                               # импосты
        s.rect((mx, y0, mx + 1, y1), '#eef3f2'); s.hd.rectangle((mx, y0, mx + 1, y1), fill=0)
    for y in range(y0, y0 + 16, 3):                             # жалюзи подняты
        s.rect((x0, y, x1, y), '#f7f4ea'); s.hd.rectangle((x0, y, x1, y), fill=0)
    s.rect((x0 - 6, y1 + 3, x1 + 6, y1 + 5), '#f6f8f6'); s.rect((x0 - 4, y1 + 6, x1 + 4, y1 + 6), '#8597a6')
    s.lit((x0 - 14, y0 - 12, x1 + 14, y1 + 12), 0.2, 9, 'rect')  # засветка стены вокруг окна
    s.lit([(x0 + 4, BASE), (x1 + 4, BASE), (x1 + 44, H), (x0 + 44, H)], 0.5, 1.5, sun=True)   # пятно солнца на полу
    for mx in (x0 + 39, x0 + 78):
        s.lit([(mx + 3, BASE), (mx + 7, BASE), (mx + 47, H), (mx + 42, H)], -0.3, 1)

def _plant(s, x, y, big=False):
    s.poly([(x - 5, y - 9), (x + 5, y - 9), (x + 4, y), (x - 4, y)], '#d9795a'); s.rect((x - 6, y - 10, x + 6, y - 9), '#eb9577')
    for dx, dy, r in ((0, -20, 7), (-6, -15, 5), (6, -16, 5), (-3, -27, 5), (4, -26, 4)) + (((0, -34, 5), (-7, -24, 4)) if big else ()):
        s.ell((x + dx - r, y + dy - r, x + dx + r, y + dy + r), '#2f7a63')
        s.ell((x + dx - r + 1, y + dy - r + 1, x + dx + 1, y + dy + 1), '#4c9c7c')

def _desk(s, x, y, who=None, screen='#bfe8f0'):
    """Стол боком: человек слева лицом вправо, монитор справа. y — пол под столом."""
    if who is not None:
        s.rect((x - 12, y - 30, x - 10, y - 10), '#39415c'); s.rect((x - 12, y - 12, x + 2, y - 10), '#39415c')   # кресло
        s.rect((x - 5, y - 10, x - 4, y - 2), '#39415c'); s.rect((x - 10, y - 2, x + 2, y - 1), '#39415c')
        s.img.paste(who, (x - 22, y - who.height + 1), who)
    s.rect((x + 14, y - 22, x + 74, y - 20), '#e0b184'); s.rect((x + 14, y - 19, x + 74, y - 18), '#a8754f')
    s.rect((x + 18, y - 17, x + 19, y), '#8c5f42'); s.rect((x + 69, y - 17, x + 70, y), '#8c5f42')
    s.rect((x + 50, y - 17, x + 70, y - 6), '#c79768')          # тумба
    s.rect((x + 40, y - 26, x + 50, y - 23), '#39415c'); s.rect((x + 44, y - 30, x + 46, y - 23), '#39415c')    # монитор
    s.rect((x + 34, y - 46, x + 56, y - 30), '#2b3148'); s.rect((x + 36, y - 44, x + 54, y - 32), screen)
    for i, ln in enumerate((12, 8, 14, 6)):
        s.rect((x + 38, y - 42 + i * 3, x + 38 + ln, y - 42 + i * 3), '#7fb4c4')
    s.rect((x + 22, y - 25, x + 26, y - 23), '#f6f8f6'); s.rect((x + 60, y - 28, x + 66, y - 23), '#f0a830')    # кружка, папка
    s.lit((x - 14, y - 6, x + 78, y + 3), -0.16, 3, 'rect')

def _pillar(s, bx, kind, glitch):
    cx = bx + 149
    if kind == 0:                                               # часы
        s.ell((cx - 8, 112, cx + 8, 128), '#f6f8f6'); s.ell((cx - 6, 114, cx + 6, 126), '#ffffff')
        s.line([(cx, 120), (cx, 115)], ACID if glitch else '#39415c'); s.line([(cx, 120), (cx + 4, 121)], '#39415c')
        _plant(s, cx, 203, big=True)
    elif kind == 1:                                             # доска со стикерами, кулер
        s.rect((cx - 15, 104, cx + 15, 134), '#f6f8f6'); s.rect((cx - 13, 106, cx + 13, 132), '#ffffff')
        for i, c in enumerate(('#f0a830', '#ef8a6a', '#6cc0c0', '#f0a830', '#b58abd', '#6cc0c0')):
            px, py = cx - 10 + i % 3 * 8, 109 + i // 3 * 11
            s.rect((px, py, px + 5, py + 6), c)
        s.rect((cx - 7, 170, cx + 7, 203), '#e6edf0'); s.rect((cx - 6, 152, cx + 6, 170), '#a9dcec'); s.rect((cx - 6, 152, cx + 6, 154), '#d6f2fa')
        s.rect((cx - 7, 182, cx + 7, 183), '#b7c4cc')
    else:                                                       # план эвакуации, принтер на тумбе
        s.rect((cx - 10, 108, cx + 10, 132), '#f6f8f6')
        for y in range(112, 130, 4):
            s.rect((cx - 7, y, cx + (5 if y % 8 else 2), y), '#9fb0ba')
        s.rect((cx - 13, 180, cx + 13, 203), '#c79768'); s.rect((cx - 13, 180, cx + 13, 181), '#e0b184')
        s.rect((cx - 10, 170, cx + 10, 180), '#e6edf0'); s.rect((cx - 6, 167, cx + 6, 170), '#ffffff'); s.rect((cx - 8, 175, cx + 8, 176), '#39415c')
        s.lit((cx - 16, 198, cx + 16, 206), -0.16, 3, 'rect')

def office(glitch=False):
    c = cast()
    s = Scene(W + 2 * PAD, H, '#c9d6d8', ambient=0.68)
    s.rect((0, 0, s.w, 56), '#dde6e6'); s.rect((0, 56, s.w, 58), '#8597a6'); s.rect((0, 58, s.w, 92), '#c2cfd3')
    s.rect((0, 176, s.w, BASE), '#a3b4bd'); s.rect((0, BASE - 3, s.w, BASE), '#6b7d94')
    s.rect((0, BASE, s.w, H), '#7484a6')
    for x in range(-120, s.w, 60):                              # швы ковролина уходят к зрителю
        s.line([(x, BASE), (x + 39, H)], '#6a7a9c')
    for y in (203, 222, 246):
        s.rect((0, y, s.w, y), '#6a7a9c')
    for x in range(8, s.w, 96):                                 # лампы
        s.rect((x, 40, x + 56, 46), '#39415c' if glitch and (x // 96) % 3 else '#fff6dc')
        if not (glitch and (x // 96) % 3):
            s.lit((x - 10, 30, x + 66, 70), 0.3, 8, 'ell')
    for i in range(-1, 4):
        bx = PAD + i * BAY
        _window(s, bx); _pillar(s, bx, i % 3, glitch)
        who = (c['sit_a'], None, c['sit_b'])[i % 3]
        _desk(s, bx + 28, 204, who, '#ffd0ea' if glitch else '#bfe8f0')
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.14, 3, 'rect')       # стык стены и пола
    s.grade(0, 92, -0.06, 0.0); s.grade(BASE, H, -0.04, 0.1)
    post = None
    if glitch:
        tone = duotone(GLITCH_RAMP)
        glow = np.asarray(s.hole.filter(ImageFilter.GaussianBlur(8)), np.float32)[..., None] / 255 * 0.85
        glow = np.maximum(glow, np.asarray(s.sun, np.float32)[..., None] / 255 * 0.3)
        post = lambda a: tone(a) * (1 - glow) + np.array(rgb(ACID), np.float32) * glow
    img = s.render(post=post, colors=40 if glitch else 56).crop((PAD, 0, PAD + W, H))
    return tear(warp(img)) if glitch else img

def warp(img, amp=4):
    """Сбой гнёт коридор: столбцы едут по синусу с периодом плитки (шов не рвётся)."""
    a = np.array(img); out = a.copy()
    for x in range(a.shape[1]):
        dy = round(amp * math.sin(2 * math.pi * x / 240) + 1.5 * math.sin(2 * math.pi * x / 96))
        out[:, x] = a[np.clip(np.arange(a.shape[0]) + dy, 0, a.shape[0] - 1), x]
    return Image.fromarray(out, 'RGBA')

def tear(img):
    """Разрывы: полосы строк съезжают вбок по кругу, по краю разрыва — кислотная нитка."""
    a = np.array(img)
    for y, hgt, dx in ((104, 2, 9), (131, 3, -14), (158, 2, 6), (187, 2, -8), (209, 3, 12), (238, 2, -10), (256, 2, 7)):
        a[y:y + hgt] = np.roll(a[y:y + hgt], dx, axis=1)
        for x0 in range((y * 37) % 90, W, 150):
            seg = slice(x0, min(W, x0 + 30 + (y * 13) % 40))
            a[y, seg] = np.where(a[y, seg, 3:4] > 0, np.array(rgb(ACID) + (255,), np.uint8), a[y, seg])
    return Image.fromarray(a, 'RGBA')
