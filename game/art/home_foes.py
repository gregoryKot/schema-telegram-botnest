"""Враги дома на сетке x2: Прокрастинация (три размера, как Тревога), Телефон, гора дел из обучения.
Контур холодный (foes.OUT) — в тёплой комнате они чужие по температуре.
"""
import numpy as np
from PIL import Image, ImageDraw
from px import C, empty_at, outline_mask, strip
from foes import OUT, below2

PROC = dict(dark='#4a5a34', base='#78883a', top='#a4b648', rim='#d8e070', eye='#f0f4d8', lid='#566830',
            pupil='#14102a', mouth='#2a3420')
PW, PH, PROC_FLOOR = 96, 46, 10          # низ лужи — на PROC_FLOOR строк выше точки привязки спрайта

def lit(a, pal):
    """Объём пятна: свет сверху (rim, top), тень снизу с дизером, холодный контур."""
    h, w = a.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[a > 0] = C(pal['base'])
    b1, b2 = below2(a)
    b3 = np.zeros_like(b1); b3[:-2] = b1[2:] & (a[:-2] > 0)
    out[b3 & ((np.add.outer(np.arange(h), np.arange(w))) % 2 == 0)] = C(pal['dark'])
    out[b1 | b2] = C(pal['dark'])
    t1 = empty_at(a, 0, -1); t2 = np.zeros_like(t1); t2[1:] = t1[:-1] & (a[1:] > 0)
    out[t2 & ~b1] = C(pal['top']); out[t1 & ~b1] = C(pal['rim'])
    out[outline_mask(a)] = C(OUT)
    return out

def proc(k, f):
    """Липкая лужа размера k: дышит (шире-ниже / уже-выше), веки тяжелеют, над ней плывёт «z»."""
    cx, by = PW // 2, PH - 2
    sq = (0, 1, -1)[f]
    w, h = round(24 * k) + sq, round(21 * k) - sq
    img = Image.new('L', (PW, PH), 0); d = ImageDraw.Draw(img)
    d.ellipse((cx - w, by - h, cx + w, by + h), fill=1)
    d.ellipse((cx - w - round(5 * k), by - round(12 * k), cx - w + round(20 * k), by + round(12 * k)), fill=1)   # плечи
    d.ellipse((cx + w - round(22 * k), by - round(14 * k), cx + w + round(6 * k), by + round(14 * k)), fill=1)
    d.rectangle((cx - w - round(7 * k), by - max(1, round(2 * k)), cx + w + round(8 * k), by), fill=1)
    a = np.array(img); a[by + 1:] = 0
    out = lit(a, PROC)
    yy, xx = np.mgrid[0:PH, 0:PW]; rel = (by - yy) / h; inner = (a > 0) & ~outline_mask(1 - a)
    odd = (xx + yy) % 2 == 0                              # объём: светлая макушка, тёмный низ, стык — шахматкой
    out[inner & (xx < cx + w * .4) & ((rel > .66) | (rel > .56) & odd)] = C(PROC['top'])
    out[inner & ((rel < .2) | (rel < .32) & odd)] = C(PROC['dark'])
    def put(x, y, c):
        if 0 <= x < PW and 0 <= y < PH: out[int(y), int(x)] = C(PROC.get(c, c))
    ew, eh = (6, 5) if k < .8 else (9, 7) if k < 1.2 else (11, 9)
    ey = by - round(14 * k); gap = max(1, round(2 * k))
    shut = eh // 2 + (1 if f == 2 else 0)                 # верхнее веко: полузакрыто, на третьем кадре ниже
    for ex in (cx - gap - ew, cx + gap):
        for yy in range(eh):
            for xx in range(ew):
                put(ex + xx, ey + yy, 'lid' if yy < shut else 'eye')
        put(ex - 1, ey + shut, 'lid'); put(ex + ew, ey + shut, 'lid')
        for dx in range(3 if k >= .8 else 2):
            for dy in range(eh - shut - (1 if eh - shut > 2 else 0)):
                put(ex + ew // 2 - 1 + dx, ey + shut + dy, 'pupil')
        for xx in range(-1, ew + 1):                      # мешки под глазами
            put(ex + xx, ey + eh, 'dark')
    for i in range(round(6 * k)):                         # рот — вялая линия
        put(cx - round(3 * k) + i, ey + eh + max(2, round(3 * k)) + (i in (0, round(6 * k) - 1)) * -1, 'mouth')
    for i in range(max(2, round(4 * k))):                 # мокрый блик на макушке
        put(cx - round(12 * k) + i, by - h + max(2, round(4 * k)) - (i > 1), 'rim')
    zx, zy = cx + w - round(4 * k) + f * 2, by - h - 3 - f * 2
    for x, y in ((0, 0), (1, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)):
        put(zx + x, zy + y, 'rim')
    return Image.fromarray(out, 'RGBA')

PHN = dict(dark='#26244e', base='#34326a', top='#4a4688', rim='#6a64ac', scr='#5fc4f0', scr2='#8adcfa',
           hi='#d6f6ff', ink='#14204a', badge='#ff4a5e')
FW, FH = 26, 30

def phone(f):
    """Телефон-зазывала: шагает на ножках, лицо на экране смотрит на тебя, красный значок зовёт."""
    img = Image.new('L', (FW, FH), 0); d = ImageDraw.Draw(img)
    d.rectangle((5, 3, 20, 25), fill=1)
    for x, y in ((5, 3), (20, 3), (5, 25), (20, 25)):
        img.putpixel((x, y), 0)
    lift = ((0, 0), (1, 0), (0, 1))[f]                    # шаг: ножки по очереди
    for x0, up_ in ((7, lift[0]), (16, lift[1])):
        d.rectangle((x0, 26, x0 + 2, 28 - up_), fill=1)
    arm = (0, -1, 1)[f]
    d.rectangle((3, 13 + arm, 4, 15 + arm), fill=1); d.rectangle((21, 13 - arm, 22, 15 - arm), fill=1)
    out = lit(np.array(img), PHN)
    im = Image.fromarray(out, 'RGBA'); p = ImageDraw.Draw(im)
    p.rectangle((7, 5, 18, 21), fill=C(PHN['scr']))
    for y in range(5 + f % 2, 22, 2):                     # строки развёртки бегут
        p.line((7, y, 18, y), fill=C(PHN['scr2']))
    p.line((7, 5, 18, 5), fill=C(PHN['hi'])); p.line((7, 5, 7, 21), fill=C(PHN['hi']))
    look = (0, 1, 1)[f]
    for ex in (9, 14):                                    # глаза с бликом и хитрые брови
        p.rectangle((ex, 10, ex + 2, 13), fill=C(PHN['hi'])); p.rectangle((ex + look, 11, ex + look + 1, 13), fill=C(PHN['ink']))
    p.line((8, 9, 11, 8), fill=C(PHN['ink'])); p.line((14, 8, 17, 9), fill=C(PHN['ink']))
    p.line((10, 17, 15, 17), fill=C(PHN['ink'])); p.point((9, 16), fill=C(PHN['ink'])); p.point((16, 16), fill=C(PHN['ink']))
    p.line((12, 23, 13, 23), fill=C(PHN['rim']))          # кнопка «домой»
    r = 2 if f == 2 else 1                                # значок уведомления пульсирует
    p.rectangle((19 - r, 3 - r + 1, 21, 5), fill=C(PHN['badge'])); p.rectangle((18 - r, 2 - r + 1, 22, 2 - r + 1), fill=C(OUT))
    p.line((22, 3 - r + 1, 22, 6), fill=C(OUT)); p.point((20, 4), fill=C('#ffffff'))
    return im

PAPER = ('#d9a886', '#f2d2a8', '#fff6e0')
WW, WH = 44, 48

def workload(f):
    """Гора дел: стопка бумаг на папках качается, сверху стакан кофе, лицо в панике, руки машут."""
    im = Image.new('RGBA', (WW, WH), (0, 0, 0, 0)); p = ImageDraw.Draw(im)
    sway = (0, 1, 0, -1)[f]
    def slab(x0, x1, y0, y1, ramp, dx=0):
        p.rectangle((x0 + dx - 1, y0 - 1, x1 + dx + 1, y1 + 1), fill=C(OUT))
        p.rectangle((x0 + dx, y0, x1 + dx, y1), fill=C(ramp[1]))
        p.line((x0 + dx, y0, x1 + dx, y0), fill=C(ramp[2])); p.line((x0 + dx, y1, x1 + dx, y1), fill=C(ramp[0]))
    slab(8, 35, 42, 46, ('#8a4e3a', '#c98552', '#e8a868'))                    # папки
    slab(10, 33, 37, 40, ('#35506e', '#4f6e8a', '#7aa0b4'))
    for i, y in enumerate(range(34, 9, -3)):                                  # листы: чем выше, тем сильнее крен
        dx = round(sway * i / 2) + (i % 2)
        slab(11, 31, y, y + 1, PAPER, dx)
        if i in (1, 4, 6):                                                    # закладки торчат
            p.rectangle((32 + dx, y, 34 + dx, y + 1), fill=C(('#ff4a5e', '#8fbf6a', '#ffe2a0')[i % 3]))
    top = round(sway * 3)
    slab(17 + top, 25 + top, 3, 8, ('#b8683a', '#f3a35c', '#ffc890'))         # стакан
    p.rectangle((16 + top, 2, 26 + top, 3), fill=C('#fff6e0')); p.point((21 + top, 6), fill=C('#8a4e3a'))
    fx = 12 + round(sway * 1.5)                                               # лицо — на верхнем листе, как записка
    slab(fx + 1, fx + 18, 18, 30, PAPER)
    for ex in (fx + 3, fx + 11):
        p.rectangle((ex, 20, ex + 4, 24), fill=C('#ffffff')); p.rectangle((ex + 1 + f % 2, 22, ex + 2 + f % 2, 24), fill=C('#14102a'))
        p.line((ex, 18, ex + 4, 19) if ex == fx + 3 else (ex, 19, ex + 4, 18), fill=C('#8a4e3a'))
    p.rectangle((fx + 7, 27, fx + 12, 29 + f % 2), fill=C('#5a2030')); p.line((fx + 8, 27, fx + 11, 27), fill=C('#14102a'))
    for side, x0 in ((-1, 8), (1, 36)):                                       # руки машут
        y1 = 22 - ((f + (side > 0)) % 2) * 6
        p.line((x0 + side * -2, 28, x0 + side * 4, y1), fill=C(OUT), width=2)
        p.rectangle((x0 + side * 4 - 1, y1 - 2, x0 + side * 4 + 1, y1), fill=C(PAPER[1]))
    for x, y in ((6, 12), (38, 9), (4, 20), (40, 17))[f % 2::2]:              # капли пота
        p.point((x, y), fill=C('#8adcfa')); p.point((x, y + 1), fill=C('#5fc4f0'))
    return im

def build():
    return {
        'enemy_proc': strip([proc(k, f) for k in (1, .68, 1.35) for f in range(3)]),   # ступени: обычная, малая, крупная
        'enemy_phone': strip([phone(f) for f in range(3)]),
        'prop_workload': strip([workload(f) for f in range(4)]),
    }
