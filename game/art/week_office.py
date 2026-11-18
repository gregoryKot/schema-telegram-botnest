"""Опенспейс «Понедельника»: задник 480x320 (кадр 480x270 + запас пола под выгиб сбоя).
Приглушённый беж и бетон; свет — из окон слева сверху. Люди за столами — тот же риг week_rig."""
from PIL import Image, ImageDraw
from px import C
from tile import BAYER4
from week_rig import figure, FH
from week_cast import colleague, KOLLEGA_A, KOLLEGA_B, boss

W, H, VIEW_H = 480, 320, 270
CEIL, FLOOR, LANE = 22, 176, 236          # низ потолка, линия пола у стены, линия стоп в проходе
ACID = '#ff3ea5'
WALL, WALL_SH, TRIM, DARK, INK = '#dcd6c8', '#cdc6b6', '#a8a49c', '#6e6a66', '#3e3c3a'
CARPET, CARPET_DK, CARPET_LT = '#b8b2a6', '#a8a49c', '#c8c2b4'
DOOR = (414, 92, 448, FLOOR)              # дверь начальницы
SIT = dict(hip=(15, 19), legs=((86, 2), (82, -2)), arms=((30, 84), (24, 86)))

def fade(img, box, c0, c1):
    """Вертикальный переход c0 -> c1 упорядоченным дизером, без промежуточных тонов."""
    x0, y0, x1, y1 = box; px = img.load(); a, b = C(c0), C(c1)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        for x in range(x0, x1):
            px[x, y] = b if t > BAYER4[y % 4, x % 4] else a

def window(img, d, x0, x1, seed):
    y0, y1 = 40, 150
    d.rectangle((x0, y0, x1, y1), fill=C('#c6d0d8')); fade(img, (x0, 86, x1, 110), '#c6d0d8', '#dfe4e2'); d.rectangle((x0, 110, x1, y1), fill=C('#dfe4e2'))
    for i, (bx, bw, bh) in enumerate(((4, 16, 44), (22, 12, 66), (36, 20, 36), (58, 14, 78), (74, 18, 52), (94, 16, 30))):
        bx = x0 + (bx + seed * 7) % (x1 - x0 - 20)
        d.rectangle((bx, y1 - bh, min(bx + bw, x1 - 1), y1 - 1), fill=C('#aeb8c2' if i % 2 else '#bcc4cc'))
        for wy in range(y1 - bh + 4, y1 - 3, 6):
            d.line((bx + 2, wy, min(bx + bw, x1 - 1) - 2, wy), fill=C('#a2acb8' if i % 2 else '#aeb8c2'))
    for y in range(y0, y0 + 22 + seed * 9, 3):                # жалюзи опущены на треть
        d.line((x0, y, x1 - 1, y), fill=C('#ece8de'))
    d.rectangle((x0 - 2, y0 - 2, x1 + 1, y1 + 1), outline=C(DARK))
    d.rectangle((x0 - 1, y0 - 1, x1, y1), outline=C(TRIM))
    mx = (x0 + x1) // 2
    d.line((mx, y0, mx, y1), fill=C(DARK)); d.line((mx + 1, y0, mx + 1, y1), fill=C(TRIM))
    d.rectangle((x0 - 3, y1 + 2, x1 + 2, y1 + 4), fill=C('#ece8de')); d.line((x0 - 3, y1 + 5, x1 + 2, y1 + 5), fill=C(TRIM))

def plant(d, x, y):
    d.polygon([(x - 6, y - 12), (x + 6, y - 12), (x + 4, y), (x - 4, y)], fill=C('#b09a7c'), outline=C(INK))
    d.line((x - 5, y - 11, x + 5, y - 11), fill=C('#c8b494'))
    for dx, dy, r in ((0, -30, 7), (-7, -22, 6), (7, -24, 6), (-3, -38, 5), (5, -34, 5)):
        d.ellipse((x + dx - r, y + dy - r, x + dx + r, y + dy + r), fill=C('#6f8062'), outline=C('#465240'))
    for dx, dy in ((-2, -33), (-9, -25), (5, -27), (-4, -41), (4, -37)):
        d.line((x + dx, y + dy, x + dx + 3, y + dy - 2), fill=C('#93a47e'))

def cooler(d, x, y):
    d.rectangle((x, y - 40, x + 15, y), fill=C('#ece8de'), outline=C(INK))
    d.rectangle((x + 2, y - 60, x + 13, y - 41), fill=C('#c6d8e4'), outline=C(INK))
    d.line((x + 3, y - 58, x + 3, y - 44), fill=C('#e8f0ff'))
    d.rectangle((x + 4, y - 30, x + 11, y - 24), fill=C(TRIM)); d.rectangle((x + 12, y - 39, x + 14, y - 1), fill=C('#cdc6b6'))

def clock(d, x, y, col=INK):
    d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=C('#f4f1ea'), outline=C(INK))
    d.line((x, y, x, y - 6), fill=C(col)); d.line((x, y, x - 4, y - 3), fill=C(col))   # без пяти три

def station(img, d, x, who, blank):
    """Рабочее место: стул, человек лицом к монитору, стол. x — левый край стула."""
    d.rectangle((x + 2, FLOOR - 46, x + 6, FLOOR - 20), fill=C(DARK), outline=C(INK))          # спинка
    d.line((x + 12, FLOOR - 16, x + 12, FLOOR - 3), fill=C(INK)); d.line((x + 4, FLOOR - 2, x + 20, FLOOR - 2), fill=C(INK))
    img.alpha_composite(figure(SIT, colleague(**who, blank=blank)), (x - 3, FLOOR - FH + 1))
    d.rectangle((x + 4, FLOOR - 19, x + 21, FLOOR - 16), fill=C(DARK))                         # сиденье
    tx = x + 28
    d.rectangle((tx, FLOOR - 36, tx + 52, FLOOR - 33), fill=C('#c8b494'), outline=C(INK))      # столешница
    d.line((tx + 1, FLOOR - 35, tx + 51, FLOOR - 35), fill=C('#dccaa8'))
    d.rectangle((tx + 2, FLOOR - 32, tx + 50, FLOOR - 10), fill=C('#b09a7c')); d.rectangle((tx + 2, FLOOR - 32, tx + 50, FLOOR - 30), fill=C('#96826a'))
    d.rectangle((tx + 3, FLOOR - 9, tx + 5, FLOOR), fill=C(DARK)); d.rectangle((tx + 47, FLOOR - 9, tx + 49, FLOOR), fill=C(DARK))
    d.rectangle((tx + 20, FLOOR - 62, tx + 46, FLOOR - 43), fill=C('#e8f0ff'), outline=C(INK))  # монитор
    for i, ly in enumerate(range(FLOOR - 59, FLOOR - 45, 3)):
        d.line((tx + 23, ly, tx + 32 + (i * 5) % 11, ly), fill=C('#a2acb8'))
    d.rectangle((tx + 32, FLOOR - 42, tx + 34, FLOOR - 38), fill=C(INK)); d.line((tx + 27, FLOOR - 37, tx + 39, FLOOR - 37), fill=C(INK))
    d.rectangle((tx + 4, FLOOR - 38, tx + 15, FLOOR - 37), fill=C(TRIM))                        # клавиатура

def door(d):
    x0, y0, x1, y1 = DOOR
    d.rectangle((x0 - 3, y0 - 3, x1 + 3, y1), fill=C(DARK)); d.rectangle((x0 - 2, y0 - 2, x1 + 2, y1), fill=C(TRIM))
    d.rectangle((x0, y0, x1, y1), fill=C('#8c8272'))
    d.rectangle((x0 + 4, y0 + 5, x1 - 4, y0 + 34), fill=C('#96826a')); d.rectangle((x0 + 4, y0 + 40, x1 - 4, y1 - 6), fill=C('#96826a'))
    d.line((x0, y0, x0, y1), fill=C('#aaa08e')); d.rectangle((x1 - 6, y0 + 44, x1 - 3, y0 + 46), fill=C('#dcd6c8'))
    d.rectangle((x0 - 22, y0 + 26, x0 - 8, y0 + 32), fill=C('#ece8de'), outline=C(DARK))        # табличка
    d.line((x0 - 19, y0 + 29, x0 - 11, y0 + 29), fill=C(TRIM))

def door_glitch(img, dy):
    """Дверь в сбое: проём вырос и светится, начальница — тёмный силуэт против света. dy — подъём пола."""
    d = ImageDraw.Draw(img); x0, x1, y1 = DOOR[0] - 10, DOOR[2] + 12, FLOOR - dy
    y0 = y1 - 124
    d.rectangle((x0 - 3, y0 - 3, x1 + 3, y1), fill=C(ACID)); d.rectangle((x0 - 1, y0 - 1, x1 + 1, y1), fill=C(INK))
    d.rectangle((x0, y0, x1, y1), fill=C('#f4f1ea'))
    fade(img, (x0, y1 - 40, x1 + 1, y1 + 1), '#f4f1ea', '#dcd6c8')
    b = boss(112, col='#2b2730')
    img.alpha_composite(b, (x0 + 2, y1 - 111))
    for i, y in enumerate(range(y0 + 9, y1 - 4, 17)):                                           # сбой цепляет и проём
        d.line((x0 - 9 + (i * 13) % 20, y, x0 + 6 + (i * 29) % 44, y), fill=C(ACID))

def near(img):
    """Ближний план — тёмные спины мониторов и листья: глубина кадра, герою не мешает."""
    d = ImageDraw.Draw(img); body, edge, hi = C('#565452'), C(INK), C(DARK)
    d.rectangle((-1, 250, 118, 271), fill=body, outline=edge); d.line((0, 251, 117, 251), fill=hi)
    d.rectangle((30, 222, 74, 248), fill=body, outline=edge); d.line((31, 223, 73, 223), fill=hi)
    d.rectangle((49, 248, 55, 250), fill=edge)
    for cx, cy, r in ((462, 262, 16), (444, 252, 11), (476, 240, 12), (456, 236, 9)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=C('#465240'), outline=edge)
        d.line((cx - r // 2, cy - r // 2, cx, cy - r + 2), fill=C('#5c6a52'))

def office(glitch=False):
    img = Image.new('RGBA', (W, H), C(WALL)); d = ImageDraw.Draw(img)
    fade(img, (0, 150, W, FLOOR - 4), WALL, WALL_SH)
    d.rectangle((0, 0, W, CEIL - 1), fill=C('#c4bdae')); d.line((0, CEIL, W, CEIL), fill=C(TRIM))
    for x in range(20, W, 96):                                 # светильники
        d.rectangle((x, 8, x + 44, 13), fill=C('#f4f1ea'), outline=C(TRIM)); d.line((x + 1, 12, x + 43, 12), fill=C('#e8f0ff'))
    for x in range(0, W, 48):
        d.line((x, 0, x, CEIL - 1), fill=C('#b8b0a0'))
    for i, x0 in enumerate((20, 150, 280)):
        window(img, d, x0, x0 + 104, i)
    d.rectangle((392, CEIL + 1, W, FLOOR), fill=C(WALL_SH)); d.line((392, CEIL + 1, 392, FLOOR), fill=C(TRIM))   # выгородка кабинета
    clock(d, 137, 62, ACID if glitch else INK)
    d.rectangle((258, 54, 276, 78), fill=C('#ece8de'), outline=C(DARK))                         # листок на колонне
    for y in range(59, 76, 4):
        d.line((261, y, 273 - (y % 3) * 2, y), fill=C(TRIM))
    # пол: ковролин плитами, свет из окон лежит пятнами
    d.rectangle((0, FLOOR, W, H), fill=C(CARPET))
    for i, x0 in enumerate((20, 150, 280)):
        d.polygon([(x0 + 26, FLOOR + 6), (x0 + 118, FLOOR + 6), (x0 + 150, FLOOR + 40), (x0 + 58, FLOOR + 40)], fill=C(CARPET_LT))
    for y in (FLOOR + 14, FLOOR + 34, FLOOR + 62, FLOOR + 100):
        d.line((0, y, W, y), fill=C(CARPET_DK))
    for k in range(-8, 30):
        d.line((k * 40, FLOOR, k * 40 + 144, H), fill=C(CARPET_DK))
    fade(img, (0, LANE + 22, W, H), CARPET, CARPET_DK)
    d.rectangle((0, FLOOR - 4, W, FLOOR - 1), fill=C(TRIM)); d.line((0, FLOOR - 4, W, FLOOR - 4), fill=C('#ece8de')); d.line((0, FLOOR, W, FLOOR), fill=C(DARK))
    if not glitch:
        door(d)
    cooler(d, 4, FLOOR); plant(d, 34, FLOOR); plant(d, 386, FLOOR)
    for i, x in enumerate((58, 162, 266)):
        station(img, d, x, (KOLLEGA_A, KOLLEGA_B)[i % 2], glitch)
    return img
