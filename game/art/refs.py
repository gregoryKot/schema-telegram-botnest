"""Э0.1: лист-эталон стиля. Кот (стоит, бежит, клубок), тревога, раздражение,
телефон, торшер, карниз, кусок асфальта. Не для игры — образец для волн 2–3:
новые ассеты сверяются с ним по контуру, свету и палитре.
"""
import math
from PIL import Image
from px import Canvas, Mat, OUT_COOL, OUT_WARM
from cat import restyle, draw
import poses, ledges, ground

def anxiety():
    """Тревога: тёмный клубок с рваным краем и двумя янтарными глазами."""
    c = Canvas(30, 26)
    pts = []
    for i in range(22):
        t = 2 * math.pi * i / 22
        r = 11 + (2.5 if i % 2 else 0) + (1 if i % 5 == 0 else 0)
        pts.append((15 + r * math.cos(t), 14 + r * 0.85 * math.sin(t)))
    c.poly(pts, 1)
    c.ell((7, 8, 13, 14), 2)                                  # внутренний завиток
    for x in (11, 18):
        c.irect((x, 12, x + 1, 13), '#ffd86a'); c.dot(x, 14, '#c89a3a')
    return c.render({1: Mat('#221e34', '#3a3550', '#55507a', OUT_COOL, shade=3),
                     2: Mat('#2c2840', '#3a3550', '#4a4568', OUT_COOL, shade=1, z=1)})

def irritation():
    """Раздражение: язык пламени со злым лицом, свет изнутри."""
    c = Canvas(24, 30)
    c.poly([(12, 1), (15, 8), (19, 5), (20, 14), (22, 20), (18, 28), (6, 28), (2, 20), (4, 12), (7, 15), (8, 6)], 1)
    c.poly([(12, 11), (16, 17), (16, 24), (8, 24), (8, 17)], 2)
    c.iline([(8, 18), (11, 19)], '#2a1a12'); c.iline([(16, 18), (13, 19)], '#2a1a12')   # брови
    c.dot(10, 20, '#2a1a12'); c.dot(14, 20, '#2a1a12')
    c.iline([(10, 23), (14, 23)], '#2a1a12')
    return c.render({1: Mat('#b8361a', '#ff5a2a', '#ff8a4a', OUT_WARM, shade=2),
                     2: Mat('#ff8a2a', '#ffb040', '#ffd86a', OUT_WARM, shade=1, z=1)})

def phone():
    """Телефон: тёмный корпус, светящийся экран, короткие ножки."""
    c = Canvas(22, 30)
    for x in (6, 14):
        c.line([(x, 22), (x - 1, 28)], 3, 2)
    c.rect((3, 1, 18, 23), 1)
    c.rect((5, 4, 16, 18), 2)
    c.iline([(7, 9), (9, 10)], '#1a2440'); c.iline([(14, 9), (12, 10)], '#1a2440')   # прищур
    for y in (13, 15):                                                       # бегущие строки уведомлений
        c.iline([(7, y), (14, y)], '#5aa8d8')
    c.iline([(9, 21), (12, 21)], '#4a4f68')                                  # кнопка
    return c.render({1: Mat('#1a1e30', '#2a2f44', '#4a4f68', OUT_COOL, shade=2),
                     2: Mat('#5aa8d8', '#8ad8ff', '#c8f0ff', OUT_COOL, shade=1, z=1, rim=False),
                     3: Mat('#1a1e30', '#2a2f44', '#3a3f58', OUT_COOL, z=-1)})

def lamp():
    """Торшер: свет абажура запечён в спрайт ореолом в 2 тона, а не эллипсом поверх."""
    c = Canvas(30, 58)
    c.uell((1, 0, 28, 26), '#4a3a52'); c.uell((4, 2, 25, 22), '#7a5a5a')     # ореол
    c.poly([(9, 4), (20, 4), (24, 16), (5, 16)], 1)                          # абажур
    c.rect((14, 17, 15, 52), 2)                                              # стойка
    c.rect((9, 53, 20, 55), 2)
    c.iline([(10, 16), (19, 16)], '#ffe6b0')                                 # кромка света
    for y in range(c.h):                                                     # внешний тон — дизеринг
        for x in range(c.w):
            if c.under.getpixel((x, y))[:3] == (0x4a, 0x3a, 0x52) and (x + y) % 2:
                c.under.putpixel((x, y), (0, 0, 0, 0))
    return c.render({1: Mat('#e8a860', '#ffd080', '#ffe6b0', OUT_WARM, shade=2),
                     2: Mat('#2a1a12', '#4a3228', '#6e4c3a', OUT_WARM)})

def sheet():
    """256x128 логических px; превью x2 = 512x256, как в брифе."""
    s = Image.new('RGBA', (256, 128), (0, 0, 0, 0))
    idle = restyle('src/cat_idle_src.png').crop((0, 0, 48, 48))
    run = restyle('src/cat_run_src.png').crop((96, 0, 144, 48))
    curl = draw(poses.freeze()[3], s=1, size=48)
    for i, im in enumerate((idle, run, curl)):
        s.alpha_composite(im, (4 + i * 50, 4))
    for x, im in ((160, anxiety()), (196, irritation()), (226, phone())):
        s.alpha_composite(im, (x, 52 - im.height))
    s.alpha_composite(lamp(), (6, 66))
    le = ledges.build()['ledge_street']
    s.alpha_composite(le.crop((0, 0, 16, 16)), (48, 70))
    for k in range(4):
        s.alpha_composite(le.crop((16, 0, 32, 16)), (64 + k * 16, 70))
    s.alpha_composite(le.crop((32, 0, 48, 16)), (128, 70))
    g = ground.build()['ground_street']
    seq = [0, 1, 4, 1, 1, 4, 1, 2]
    for k, f in enumerate(seq):
        s.alpha_composite(g.crop((f * 16, 0, f * 16 + 16, 16)), (112 + k * 16, 96))
        if 0 < k < 7:
            s.alpha_composite(g.crop((48, 0, 64, 16)), (112 + k * 16, 112))
    return s
