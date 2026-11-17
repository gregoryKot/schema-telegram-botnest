"""Комната гл.2 «Дома», тёплый вечер (палитра CH2): стена-тайл с панелями и обоями, пятно света
торшера (та же стена в светлых тонах, край — дизером), окно с сумерками, пол досками в перспективе.
Высоты — «над полом»: a=0 — строка прямо над линией пола.
"""
from PIL import Image, ImageDraw
from px import C, PAL
from tile import BAYER4

P = PAL['ch2']
INK = P['ink']
WALL_W, WALL_H = 32, 216
# тон стены: (обои, узор, панель, свет панели, тень панели, рейка, тень рейки, плинтус, блик, низ плинтуса)
DIM = ('#b27470', '#c18478', '#96596a', '#a96a6e', '#7e4b5c', '#e8bf98', '#c99a80', '#8a4e3a', '#b06e46', '#5a3030')
LIT = ('#dc9f88', '#f2c09e', '#c07e76', '#d69a88', '#a8676a', '#fff0cc', '#f2d2a8', '#b06e46', '#e8a868', '#7a4436')
TOP = ('#a8676a', '#b87872')              # верх стены уходит в вечернюю тень

def wall(tone=DIM):
    paper, pat, panel, p_hi, p_dk, rail, rail_dk, base, base_hi, base_dk = (C(c) for c in tone)
    img = Image.new('RGBA', (WALL_W, WALL_H)); px = img.load()
    for a in range(WALL_H):
        y = WALL_H - 1 - a
        for x in range(WALL_W):
            if a < 2: col = base_dk
            elif a < 7: col = base
            elif a == 7: col = base_hi
            elif a < 43:                                   # панель с филёнкой: свет сверху-слева
                col = panel
                if 4 <= x <= 27 and 12 <= a <= 39:
                    if a == 39 or x == 4: col = p_dk
                    elif a == 12 or x == 27: col = p_hi
            elif a == 43: col = p_dk
            elif a == 44: col = rail_dk
            elif a == 45: col = rail
            else:
                col = paper
                u, v = (x + (8 if (a // 16) % 2 else 0)) % 16, a % 16
                if abs(u - 4) + abs(v - 8) <= 2 and (u, v) != (4, 8) or (u, v) == (12, 0): col = pat
                if tone is DIM and (a > 176 or a > 170 and (a - 170) / 6 > BAYER4[y % 4, x % 4]):
                    col = C(TOP[1] if col == pat else TOP[0])  # к потолку темнее; дизер — только на стыке
                if tone is DIM and a in (206, 207): col = C('#8a5462') if a == 206 else rail_dk   # карниз под потолком
            px[x, y] = col
    return img

GLOW_W, GLOW_H, GLOW_A = 192, 160, 70     # центр пятна — на высоте абажура

def glow():
    """Освещённая стена вокруг торшера: ядро сплошное, к краю редеет — под ней та же стена в тени."""
    lit = wall(LIT)
    img = Image.new('RGBA', (GLOW_W, GLOW_H), (0, 0, 0, 0))
    for y in range(GLOW_H):
        a = GLOW_H - 1 - y
        for x in range(GLOW_W):
            d = (((x - GLOW_W / 2 + .5) / 94) ** 2 + ((a - GLOW_A) / 84) ** 2) ** .5
            if d < 1 and BAYER4[y % 4, x % 4] < (1 - d) * 1.5:
                img.putpixel((x, y), lit.getpixel((x % WALL_W, WALL_H - 1 - a)))
    return img

SKY = ['#4f4688', '#6a5a9e', '#8a64a0', '#b8709c', '#e88aa0', '#f7a98c', '#ffc878']

WIN_W, WIN_H = 84, 86

def window():
    """Окно 84x86: за стеклом сумерки над крышами — последний свет заката из гл.1; шторы и подоконник."""
    W = WIN_W
    img = Image.new('RGBA', (W, WIN_H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    gx0, gy0, gx1, gy1 = 12, 7, W - 13, 73
    for y in range(gy0, gy1 + 1):
        k = (y - gy0) / (gy1 - gy0) * (len(SKY) - 1)
        for x in range(gx0, gx1 + 1):
            i = min(len(SKY) - 1, int(k) + (k % 1 > .5 and (k % 1 - .5) * 2 > BAYER4[y % 4, x % 4]))
            img.putpixel((x, y), C(SKY[i]))
    for x, y in ((17, 10), (30, 15), (50, 9), (64, 18), (44, 22), (69, 11)):     # первые звёзды
        img.putpixel((x, y), C('#fff0cc'))
    for x0, x1, top, col in ((12, 24, 58, '#9a6a98'), (34, 50, 54, '#9a6a98'), (56, 71, 59, '#9a6a98'),
                             (18, 33, 63, '#5a4680'), (40, 55, 65, '#5a4680'), (12, 17, 67, '#5a4680'), (62, 71, 62, '#5a4680')):
        d.rectangle((x0, top, x1, gy1), fill=C(col))
    d.line((44, 54, 44, 48), fill=C('#9a6a98')); d.line((66, 62, 66, 57), fill=C('#5a4680'))  # антенны
    for x, y in ((21, 66), (27, 69), (43, 68), (49, 70), (14, 70), (65, 66), (69, 70), (38, 59), (59, 62)):
        img.putpixel((x, y), C('#ffd27a'))
    d.line((16, 30, 28, 18), fill=C('#8a7ac0')); d.line((19, 33, 25, 27), fill=C('#8a7ac0'))    # блик стекла
    for k, col in enumerate((INK, P['wood_hi'], P['wood'], P['wood_dk'])):
        d.rectangle((8 + k, 3 + k, W - 9 - k, 77 - k), outline=C(col))
    d.rectangle((W // 2 - 1, 7, W // 2, 73), fill=C(P['wood'])); d.line((W // 2 + 1, 7, W // 2 + 1, 73), fill=C(P['wood_dk']))
    d.rectangle((12, 39, W - 13, 40), fill=C(P['wood'])); d.line((12, 41, W - 13, 41), fill=C(P['wood_dk']))
    d.rectangle((3, 78, W - 4, 83), fill=C(INK))                                                # подоконник
    d.line((4, 79, W - 5, 79), fill=C(P['trim'])); d.rectangle((4, 80, W - 5, 81), fill=C(P['wood_hi']))
    d.line((4, 82, W - 5, 82), fill=C(P['wood_dk']))
    d.rectangle((0, 0, W - 1, 2), fill=C(INK)); d.line((1, 1, W - 2, 1), fill=C(P['wood_hi']))  # карниз штор
    for x0, side in ((2, 1), (W - 13, -1)):               # шторы подхвачены: складки, низ волной
        for i in range(11):
            x = x0 + i; fold = (i if side > 0 else 10 - i) % 4
            col = ('#8a3348', P['rug'], P['rug_hi'], P['rug'])[fold]
            d.line((x, 3, x, 72 + (fold % 2) * 2), fill=C(col))
        for x in (x0 - 1, x0 + 11):
            d.line((x, 3, x, 73), fill=C(INK))
        d.line((x0, 75, x0 + 10, 75), fill=C(INK)); d.line((x0, 74, x0 + 10, 74), fill=C('#8a3348'))
        d.line((x0, 46, x0 + 10, 46), fill=C(P['trim'])); d.line((x0, 47, x0 + 10, 47), fill=C(INK))  # подхват
    return img

T, DEEP = 16, 64
ROWS = [2, 9, 17, 27, 39, 52, 64]         # доски уходят к зрителю: ряд шире, цвет глуше
TONE = ['#b06e46', '#9a5a3e', '#8a4e3a', '#7a4436', '#6b3a32', '#5a3030', '#4a2628', '#4a2628']
JOINTS = {0: {1: 7, 4: 9}, 1: {0: 5, 2: 11, 4: 3}, 2: {1: 8, 3: 5}, 3: {1: 9, 3: 4, 5: 13}, 4: {0: 12, 2: 3, 5: 7}}
JUT = [1, 0, 2, 0, 3, 1, 2]               # обломанные торцы досок у ямы
PIT = [(0, '#3e1e2a'), (12, '#32182a'), (28, '#261222'), (44, '#1c0c1a')]

def floor():
    """Лист пола 96x64: столбы — левый край, середина, правый край, две середины, темнота ямы."""
    img = Image.new('RGBA', (T * 6, DEEP), (0, 0, 0, 0)); px = img.load()
    for f in range(5):
        for y in range(DEEP):
            r = next(i for i in range(6) if y < ROWS[i + 1]) if y >= 2 else -1
            for x in range(T):
                if r < 0: col = ('#f2c088', '#c98552')[y]
                elif y == ROWS[r]: col = TONE[r + 2]
                elif y == ROWS[r] + 1 and r < 3: col = TONE[max(0, r - 1)] if r else '#c98552'
                elif JOINTS[f].get(r) == x: col = TONE[r + 2]
                elif (x * 5 + y * 3 + f * 7) % 29 == 0 and y > ROWS[r] + 2: col = TONE[r + 1]   # волокна
                else: col = TONE[r]
                if y >= 58 and (y >= 61 or (x + y) % 2): col = TONE[6]
                px[f * T + x, y] = C(col)
        if f in (0, 2):                                    # берег ямы: торцы досок вразнобой, контур
            for y in range(DEEP):
                j = 1 if y < 2 else JUT[next(i for i in range(6) if y < ROWS[i + 1])]
                for k in range(j + 1):
                    x = k if f == 0 else T - 1 - k
                    px[f * T + x, y] = C(INK) if k == j else (0, 0, 0, 0)
    for y in range(DEEP):
        band = max(i for i, (y0, _) in enumerate(PIT) if y >= y0)
        nxt = PIT[band + 1][0] if band + 1 < len(PIT) else DEEP + 99
        for x in range(T):
            up = nxt - y <= 4 and (nxt - y) / 4 <= BAYER4[y % 4, x % 4]
            px[5 * T + x, y] = C(PIT[band + 1 if up else band][1])
    return img

def build():
    return {'bg_room_wall': wall(), 'room_glow': glow(), 'prop_window': window(), 'ground_room': floor()}
