"""Вещи хука: стопки дел, стена уведомлений, дверь начальницы, бордюр и ступени улицы, лужа, Мистер.
Красит общий px.render — контур и свет те же, что у людей."""
from PIL import Image
from px import Canvas, Mat, C, strip
from cat import pose, paint, SKIN
from poses import IDLE, TAILS
from week_rig import OUT

ACID = '#ff3ea5'
PAPER, FOLD_A, FOLD_B, FOLD_C, STONE, WOOD, KNOB, PINK, DARK, PLATE = range(1, 11)
MATS = {
    PAPER: Mat('#b9c2dc', '#f4f6fa', '#ffffff', out=OUT, shade=1, dither=False),
    FOLD_A: Mat('#b5651d', '#f0a830', '#ffd66b', out=OUT, shade=1, dither=False),
    FOLD_B: Mat('#9a4a3c', '#e0785a', '#f2a488', out=OUT, shade=1, dither=False),
    FOLD_C: Mat('#2f6f78', '#4b97a0', '#86c5c8', out=OUT, shade=1, dither=False),
    STONE: Mat('#8d7f92', '#c9b9b4', '#efe4dc', out=OUT, shade=2),
    WOOD: Mat('#7a4a3a', '#b9704c', '#dc9a6c', out=OUT, shade=2, z=1), KNOB: Mat('#b5651d', '#f0a830', '#ffd66b', out=OUT, z=2, shade=0),
    PINK: Mat('#c21f78', ACID, '#ff9ad0', out=OUT, shade=1, dither=False),
    DARK: Mat('#0b0820', '#17103a', '#3b2d80', out='#0b0820', shade=1, z=1, dither=False),
    PLATE: Mat('#b9c2dc', '#f4f6fa', '#ffffff', out=OUT, z=2, shade=0),
}
PILE_H = (20, 23, 25, 28, 53, 85)          # высоты стопок главы в px арта (game/src/week/monday.ts, пополам)
PILE_FW, PILE_FH = 26, 88

def pile(h):
    """Стопка дел высотой h: бумага вперемешку с папками, листы торчат вразнобой."""
    c = Canvas(PILE_FW, PILE_FH); y = PILE_FH - 1; i = h
    while y > PILE_FH - h:
        i = (i * 1103515245 + 12345) & 0x7fffffff
        fold = (i >> 5) % 3 == 0
        t = min(5 if fold else 3, y - (PILE_FH - h) + 1); dx = (i >> 9) % 4 - 1
        c.rect((3 + dx, y - t + 1, 21 + dx, y), (FOLD_A, FOLD_B, FOLD_C)[(i >> 12) % 3] if fold else PAPER)
        if not fold:
            c.iline([(4 + dx, y), (20 + dx, y)], '#8a93c8')          # листы читаются по одному
        y -= t
    return c.render(MATS)

def notif_wall():
    """Стена уведомлений поперёк коридора: пузыри сообщений до потолка."""
    c = Canvas(40, 132)
    for i, y in enumerate(range(2, 126, 16)):
        x, w = (2, 7, 0, 9, 4, 1, 8, 3)[i], (28, 30, 34, 26, 32, 36, 28, 33)[i]
        c.d.rounded_rectangle((x, y, x + w, y + 11), 3, fill=PINK if i % 3 else PAPER)
        c.poly([(x + 4, y + 11), (x + 9, y + 11), (x + 3, y + 15)], PINK if i % 3 else PAPER)
        for j, ln in enumerate((w - 10, w - 16)):
            c.iline([(x + 4, y + 3 + j * 4), (x + 4 + ln, y + 3 + j * 4)], '#ffffff' if i % 3 else '#5b6382')
    return c.render(MATS)

def door(glitch=False):
    """Дверь начальницы. В сбое — тёмный проём в кислотной раме: растёт, а ближе не становится."""
    c = Canvas(34, 62)
    c.rect((1, 1, 32, 61), PINK if glitch else PLATE)
    c.rect((4, 4, 29, 61), DARK if glitch else WOOD)
    if not glitch:
        c.irect((8, 9, 25, 30), '#a05e42'); c.irect((8, 36, 25, 56), '#a05e42')
        c.rect((24, 32, 26, 34), KNOB); c.irect((11, 14, 22, 18), '#f4f6fa')
    else:
        for y in range(8, 58, 9):
            c.iline([(4 + y % 7, y), (22 + y % 9, y)], '#3b2d80')
    return c.render(MATS)

def block(w, h):
    c = Canvas(w, h); c.rect((0, 0, w - 1, h - 1), STONE)
    return c.render(MATS, outline=False)

def puddle():
    img = Image.new('RGBA', (46, 4), (0, 0, 0, 0)); p = img.load()
    for y, (x0, x1) in enumerate(((6, 40), (1, 45), (0, 44), (8, 38))):
        for x in range(x0, x1):
            p[x, y] = C('#bfe0ee' if (x * 3 + y * 5) % 11 < 3 else '#7f9fca')
    return img

def mister():
    """Мистер на подоконнике: тёплая утренняя кромка, хвост покачивается."""
    skin = dict(SKIN, top='#7a5a6a', rim='#ffc98a', rim2='#fff0cc')
    return strip([paint(pose(dict(IDLE, tail=t)), skin) for t in TAILS])

def props():
    return {
        'wk_piles': strip([pile(h) for h in PILE_H]), 'wk_notif_wall': notif_wall(),
        'wk_door': strip([door(), door(True)]), 'wk_curb': block(22, 11), 'wk_step': block(35, 15), 'wk_step_hi': block(35, 30),
        'wk_puddle': puddle(), 'wk_mister': mister(),
    }
