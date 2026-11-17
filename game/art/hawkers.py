"""Зазывалы дороги гл.3 на сетке x2: «Само-Пройдёт» (призрак-колыбельная), «Это-Дорого» (торгаш с монетой),
«Кривое зеркало». Не враги — продавцы неверных выборов: контур тот же холодный, что у врагов гл.1,
но сами они нарядные и манящие. Каждая часть — маска: свет сверху, зарево справа, тень снизу."""
import numpy as np
from PIL import Image, ImageDraw
from px import C, empty_at, outline_mask, strip

OUT = '#1c1838'

def part(size, draw, base, dark, top, rim=None, out=OUT):
    """Одна часть фигуры: draw(d) рисует маску; возвращает слой с заливкой, светотенью и контуром."""
    m = Image.new('L', size, 0); draw(ImageDraw.Draw(m)); a = np.array(m)
    o = np.zeros((size[1], size[0], 4), np.uint8)
    o[a > 0] = C(base)
    b1 = empty_at(a, 0, 1); b2 = np.zeros_like(b1); b2[:-1] = b1[1:] & (a[:-1] > 0)
    o[b1 | b2 | empty_at(a, -1, 0)] = C(dark)
    o[empty_at(a, 0, -1)] = C(top)
    if rim:
        o[empty_at(a, 1, 0) & ~b1] = C(rim)
    o[outline_mask(a)] = C(out)
    return Image.fromarray(o, 'RGBA')

def stack(size, parts):
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    for p in parts:
        img.alpha_composite(p)
    return img, ImageDraw.Draw(img)

# ── «Само-Пройдёт»: бледный сонный дух, хвост-завиток, над ним плывут «z» ──
SW, SH = 28, 44
GHOST = dict(base='#cfe2f6', dark='#9cb4de', top='#ffffff', rim='#ffd6d8')

def soothe(f):
    sway = (0, 1, 0, -1)[f]; dy = (0, 0, 1, 1)[f]
    def body(d):
        d.ellipse((5, 8 + dy, 22, 25 + dy), fill=1)                                   # голова
        d.polygon([(6, 13 + dy), (7, 4 + dy), (12, 9 + dy)], fill=1)                  # уши
        d.polygon([(16, 9 + dy), (21, 4 + dy), (21, 13 + dy)], fill=1)
        for i, (x, y, r) in enumerate([(13, 26, 7), (13, 30, 6), (12, 33, 5), (11, 36, 4), (9, 38, 3), (7, 40, 2)]):
            x += round(sway * i * .7)                                                # тело сходит в хвост
            d.ellipse((x - r, y - r + dy, x + r, y + r + dy), fill=1)
        d.ellipse((2 + sway * 3, 38 + dy, 6 + sway * 3, 41 + dy), fill=1)             # завиток
    img, d = stack((SW, SH), [part((SW, SH), body, **GHOST)])
    ink = C('#3c4a8c')
    for ex in (8, 16):                                                                # закрытые глаза — дужки вниз
        d.line((ex, 16 + dy, ex + 3, 16 + dy), fill=ink); d.point([(ex - 1, 15 + dy), (ex + 4, 15 + dy)], fill=ink)
    d.point([(12, 20 + dy), (15, 20 + dy)], fill=ink); d.line((13, 21 + dy, 14, 21 + dy), fill=ink)   # улыбка
    d.point([(7, 19 + dy), (20, 19 + dy)], fill=C('#ffb4c4'))                         # румянец
    zx, zy = 22 + (f % 2), 6 - f                                                      # «z» уплывает вверх
    for x, y in ((0, 0), (1, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)):
        if 0 <= zy + y < SH: d.point((zx + x, zy + y), fill=C('#ffffff' if f < 3 else '#cfe2f6'))
    return img

# ── «Это-Дорого»: торгаш в сливовом плаще трясёт золотой монетой ──
BW, BH = 46, 42
CLOAK = dict(base='#6a3466', dark='#44204a', top='#96558c', rim='#f0a4b0')
SKIN = dict(base='#86aa4e', dark='#5a7e3c', top='#b4d070', rim='#d8e890')
GOLD = dict(base='#ffc23a', dark='#c8801c', top='#fff3c4', rim='#ffe680')

def bargainer(f):
    bob = (0, 1, 0, 1)[f]; lift = (0, -1, -2, -1)[f]
    cx, cy = 11, 11 + lift                                                            # монета над головой
    cloak = part((BW, BH), lambda d: (d.ellipse((8, 17 + bob, 36, 44), fill=1), d.rectangle((0, 40, BW, BH), fill=0),
                                      d.polygon([(8, 39), (5, 39), (10, 30)], fill=1)), **CLOAK)
    arm = part((BW, BH), lambda d: d.line([(18, 24 + bob), (13, 19 + lift)], fill=1, width=4), **CLOAK)
    hand = part((BW, BH), lambda d: d.ellipse((10, 15 + lift, 15, 20 + lift), fill=1), **SKIN)
    coin = part((BW, BH), lambda d: d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=1), **GOLD)
    ear = part((BW, BH), lambda d: d.polygon([(22, 12 + bob), (15, 7 + bob), (23, 16 + bob)], fill=1), **SKIN)
    face = part((BW, BH), lambda d: (d.ellipse((24, 10 + bob, 37, 23 + bob), fill=1),
                                     d.polygon([(34, 15 + bob), (44, 18 + bob), (35, 20 + bob)], fill=1)), **SKIN)   # нос крючком
    hood = part((BW, BH), lambda d: (d.pieslice((20, 5 + bob, 38, 25 + bob), 150, 340, fill=1),
                                     d.polygon([(21, 9 + bob), (17, 3 + bob), (27, 6 + bob)], fill=1)), **CLOAK)     # колпак
    sack = part((BW, BH), lambda d: d.ellipse((27, 30 + bob, 36, 39), fill=1), base='#c88a4a', dark='#8a5a30', top='#f0c080', rim='#ffe0a0')
    feet = part((BW, BH), lambda d: (d.ellipse((12, 38, 20, 41), fill=1), d.ellipse((25, 38, 33, 41), fill=1)), base='#2e1a3a', dark='#1c1028', top='#4a2e56')
    img, d = stack((BW, BH), [feet, cloak, sack, ear, face, hood, arm, coin, hand])
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), outline=C(GOLD['dark']))                # ободок монеты
    for x, y in ((0, -3), (1, -3), (-1, -2), (-1, -1), (-1, 0), (0, 0), (1, 0), (2, -1), (2, -2), (-1, 1), (-1, 2), (-1, 3), (-2, 1), (0, 1)):
        d.point((cx + x, cy + y), fill=C('#8a5210'))                                  # «₽»
    gx, gy = [(-4, -5), (4, -4), (5, 3), (-5, 2)][f]                                  # блик бежит по ободу
    d.point([(cx + gx, cy + gy), (cx + gx + 1, cy + gy), (cx + gx, cy + gy + 1)], fill=C('#ffffff'))
    d.rectangle((30, 14 + bob, 32, 15 + bob), fill=C('#ffe066')); d.point((32, 15 + bob), fill=C('#1c1028'))   # глаз
    d.line((29, 12 + bob, 33, 13 + bob), fill=C('#2e4a20'))                           # хитрая бровь
    d.line((29, 20 + bob, 34, 21 + bob), fill=C('#2e4a20')); d.point([(30, 21 + bob), (32, 21 + bob)], fill=C('#ffffff'))   # ухмылка с зубами
    d.line((30, 31 + bob, 33, 31 + bob), fill=C('#8a5a30')); d.point((31, 34 + bob), fill=C(GOLD['base']))    # кошель
    for x in range(12, 34, 5):                                                        # заплаты-стежки по подолу
        d.point((x, 36), fill=C(CLOAK['top']))
    return img

# ── «Кривое зеркало»: золочёная рама на ножках, в стекле — самодовольное «ты в порядке» ──
MW, MH = 44, 70
GLASS = dict(base='#4f7ee0', dark='#2e52b4', top='#9cc0ff', rim='#9cc0ff')

def mirror(f):
    frame = part((MW, MH), lambda d: (d.ellipse((4, 6, 39, 56), fill=1), d.polygon([(22, 0), (16, 8), (28, 8)], fill=1),
                                      d.ellipse((18, 1, 26, 9), fill=1), d.rectangle((19, 55, 25, 62), fill=1)), **GOLD)
    feet = part((MW, MH), lambda d: (d.polygon([(22, 60), (6, 68), (6, 70), (38, 70), (38, 68)], fill=1), d.rectangle((0, MH, MW, MH), fill=0),
                                     d.ellipse((3, 63, 11, 69), fill=1), d.ellipse((33, 63, 41, 69), fill=1)), **GOLD)
    glass = part((MW, MH), lambda d: d.ellipse((9, 11, 34, 51), fill=1), out=GOLD['dark'], **GLASS)
    img, d = stack((MW, MH), [feet, frame, glass])
    a = np.array(img); ys, xs = np.mgrid[0:MH, 0:MW]
    inside = ((xs - 21.5) / 11.5) ** 2 + ((ys - 31) / 19) ** 2 <= 1
    band = (xs + ys * .6 - 22 - f * 7) % 34                                           # косой блик ползёт по стеклу
    a[inside & (band < 3)] = C('#b8d4ff'); a[inside & (band >= 5) & (band < 6)] = C('#9cc0ff')
    a[inside & (ys > 40) & ((xs + ys) % 2 == 0)] = C(GLASS['dark'])
    img = Image.fromarray(a, 'RGBA'); d = ImageDraw.Draw(img)
    ink, lid = C('#16245c'), C('#2e52b4')
    for ex in (14, 24):                                                               # полуприкрытые глаза, бровь дугой
        d.rectangle((ex, 26, ex + 5, 28), fill=C('#eaf2ff')); d.line((ex, 26, ex + 5, 26), fill=lid)
        d.rectangle((ex + 2 + (f % 2), 27, ex + 3 + (f % 2), 28), fill=ink)
        d.line((ex, 23, ex + 5, 22 if ex > 20 else 23), fill=ink)
    d.line((16, 37, 24, 37), fill=ink); d.line((24, 37, 27, 35), fill=ink); d.point((15, 36), fill=ink)   # ухмылка в сторону
    d.ellipse((20, 2, 24, 6), fill=C('#e84a6a')); d.point((21, 3), fill=C('#ffc0cc'))  # камень в навершии
    d.ellipse((20, 57, 24, 61), fill=C('#4f7ee0')); d.point((21, 58), fill=C('#d0e4ff'))
    for i, (x, y) in enumerate([(6, 14), (37, 22), (5, 44), (36, 48)]):               # искры по раме по очереди
        if i == f:
            d.point([(x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)], fill=C('#fff3c4')); d.point((x, y), fill=C('#ffffff'))
    return img

def build():
    return {'enemy_soothe': strip([soothe(f) for f in range(4)]), 'enemy_bargainer': strip([bargainer(f) for f in range(4)]),
            'enemy_mirror': strip([mirror(f) for f in range(4)])}
