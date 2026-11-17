"""Кот Мистер: кадр 36x36, показ x2 (72 px на экране). Окрас — чёрный с тёплой кромкой.

Голова — ручной штамп (лицо решает выразительность), тело, лапы и хвост — риг
примитивов в карту материалов; paint() красит её: тень снизу, свет неба сверху,
солнце справа (px.sun_rim), контур тёмным оттенком шерсти.
"""
import math
import numpy as np
from PIL import Image, ImageDraw
from px import C, empty_at, outline_mask, sun_rim

FS = 36
GY = FS - 1   # нижняя строка кадра — земля
BODY, FAR, LITE, EARIN, IRIS, PUP, GLINT, NOSE, MOUTH, TAIL, HEAD, PAW, LID, LEG, WRAP = range(1, 16)

HEAD_UP = [
    "..b..........b..",
    ".bib........bib.",
    ".biib......biib.",
    ".biibbbbbbbbiib.",
    ".bbbbbbbbbbbbbb.",
    "bbbbbbbbbbbbbbbb",
    "bbbJJJbbbbJJJJbb",
    "bbbIGPbbbbIGPIbb",
    "bbbIPPbbbbIPPIbb",
    "bbbbIbbbbbbIIbbb",
    "bbbbbbbbnbbbbbbb",
    ".bbbbbbmMmbbbbb.",
    "..bbbbbbbbbbbb..",
]
# рывок и удар: уши прижаты назад, глаза сужены — решимость
HEAD_DASH = [
    "................",
    "................",
    "bbbb........bb..",
    ".biibb....bbiib.",
    "..bbbbbbbbbbbbb.",
    "bbbbbbbbbbbbbbbb",
    "bbbbbbbbbbbbbbbb",
    "bbbJGPbbbbJGPJbb",
    "bbbIPPbbbbIPPIbb",
    "bbbbbbbbbbbbbbbb",
    ".bbbbbbbnbbbbbb.",
    ".bbbbbbmMmbbbbb.",
    "..bbbbbbbbbbbb..",
]
_SHUT = ["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbPPPbbbbPPPPbb", "bbbbbbbbbbbbbbbb"]
HEAD_BLINK = HEAD_UP[:6] + _SHUT + HEAD_UP[10:]
# устал: веки наполовину
HEAD_HALF = HEAD_UP[:6] + ["bbbbbbbbbbbbbbbb", "bbbPPPbbbbPPPPbb", "bbbIPPbbbbIPPIbb", "bbbbbbbbbbbbbbbb"] + HEAD_UP[10:]
# сон и сдача: уши прижаты, глаза закрыты
HEAD_SLEEP = HEAD_DASH[:6] + _SHUT + HEAD_DASH[10:]
# на спине: та же голова вверх ногами
HEAD_BACK, HEAD_BACK_SHUT = HEAD_HALF[::-1], HEAD_BLINK[::-1]
KEY = {'J': LID, 'b': HEAD, 'i': EARIN, 'I': IRIS, 'P': PUP, 'G': GLINT, 'n': NOSE, 'm': LITE, 'M': MOUTH}

def oval(cx, cy, rx, ry, ang=0.0, n=28):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + rx * math.cos(t) * ca - ry * math.sin(t) * sa,
             cy + rx * math.cos(t) * sa + ry * math.sin(t) * ca)
            for t in (2 * math.pi * i / n for i in range(n))]

def pose(p):
    """Поза (dict) -> карта материалов. Ключи: body, head, tail, far, near; необязательные —
    face, tail_w, belly (светлое брюхо), wrap (хвост поверх тела), paws=False, pads (подушечки),
    seam=True (голова лежит на теле — шов по её краю)."""
    img = Image.new('L', (FS, FS), 0); d = ImageDraw.Draw(img)
    for pts in p['far']:
        d.line(pts, fill=FAR, width=2)
    if 'tail' in p:
        d.line(p['tail'], fill=TAIL, width=p.get('tail_w', 3))
        tx, ty = p['tail'][-1]
        d.ellipse((tx - 1, ty - 1, tx + 1, ty + 1), fill=TAIL)
    d.ellipse(p['body'], fill=BODY)
    if 'belly' in p:
        d.ellipse(p['belly'], fill=LITE)
    for pts in p['near']:
        d.line(pts, fill=LEG, width=3)
        x, y = pts[-1]
        if p.get('paws', True):
            d.rectangle((x - 1, y - 1, x + 1, y), fill=PAW)
    hx, hy = p['head']
    for j, row in enumerate(p.get('face', HEAD_UP)):
        for i, ch in enumerate(row):
            if ch in KEY and 0 <= hx + i < FS and 0 <= hy + j < FS:
                img.putpixel((hx + i, hy + j), KEY[ch])
    if 'wrap' in p:
        d.line(p['wrap'], fill=WRAP, width=3)
    for x, y in p.get('pads', ()):
        img.putpixel((x, y), NOSE)
    return np.array(img)

SKIN = dict(out='#120b16', base='#2c2236', dark='#1d1526', top='#6a4058', rim='#ff9a5c', rim2='#ffd38a',
            far='#1a1322', lite='#3d3048', earin='#d0607a', iris='#ffc23a', lid='#fff27a', pup='#120b16',
            glint='#ffffff', nose='#ef7a92', mouth='#120b16')
STREAK = (SKIN['rim'], SKIN['rim2'])

def paint(a, s=SKIN, seam=False):
    h, w = a.shape
    out = np.zeros((h, w, 4), np.uint8)
    fur = np.isin(a, [BODY, HEAD, TAIL, LEG, WRAP])
    trunk = np.isin(a, [BODY, HEAD])
    flat = {BODY: 'base', HEAD: 'base', TAIL: 'base', LEG: 'base', PAW: 'base', WRAP: 'base', FAR: 'far',
            LITE: 'lite', EARIN: 'earin', IRIS: 'iris', LID: 'lid', PUP: 'pup', GLINT: 'glint',
            NOSE: 'nose', MOUTH: 'mouth'}
    for k, name in flat.items():
        out[a == k] = C(s[name])
    # тень снизу: два нижних пикселя меха над пустотой
    below1 = empty_at(a, 0, 1)
    below2 = np.zeros_like(below1); below2[:-1] = below1[1:] & (a[:-1] > 0)
    for msk in (below1, below2):
        out[msk & fur] = C(s['dark'])
    # шов голова/тело — тёмная линия под подбородком
    chin = np.zeros_like(fur); chin[1:] = (a[:-1] == HEAD) & np.isin(a[1:], [BODY, LITE, LEG])
    out[chin] = C(s['dark'])
    # хвост поверх тела читается по светлой верхней кромке
    wtop = np.zeros_like(fur); wtop[1:] = (a[1:] == WRAP) & (a[:-1] != WRAP)
    out[wtop] = C(s['top'])
    if seam:
        left = np.zeros_like(fur); left[:, :-1] = (a[:, :-1] == BODY) & (a[:, 1:] == HEAD)
        over = np.zeros_like(fur); over[1:] = (a[1:] == HEAD) & (a[:-1] == BODY)
        out[left] = C(s['dark']); out[over] = C(s['top'])
    sun_rim(out, a, trunk, s['top'], s['rim'], s['rim2'])
    out[(a == FAR) & empty_at(a, 0, -1)] = C(s['dark'])
    out[outline_mask(a)] = C(s['out'])
    return Image.fromarray(out, 'RGBA')

def streaks(img, rows):
    """Штрихи скорости цветом кромки, без контура: (y, x0, x1), только по пустому."""
    for y, x0, x1 in rows:
        for x in range(x0, x1):
            if img.getpixel((x, y))[3] == 0:
                img.putpixel((x, y), C(STREAK[1] if x > x0 + 2 else STREAK[0]))
    return img

def frame(p):
    return streaks(paint(pose(p), seam=p.get('seam', False)), p.get('streaks', ()))
