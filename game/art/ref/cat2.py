"""Мистер, редизайн: кадр 36x36 (показ x2 = 72 px, тот же бокс, что 48 x1.5 сейчас).
Голова — ручной штамп (лицо решает выразительность), тело/лапы/хвост — риг примитивов."""
import numpy as np
from PIL import Image
from pix import Map, C, neighbors_empty, outline_mask

FS = 36
BODY, FAR, LITE, EARIN, IRIS, PUP, GLINT, NOSE, MOUTH, TAIL, HEAD, PAW, IRIS2, LEG, CHEST = range(1, 16)

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
# рывок: уши прижаты назад, глаза сужены — решимость
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
# моргание
HEAD_BLINK = HEAD_UP[:6] + ["bbbbbbbbbbbbbbbb", "bbbbbbbbbbbbbbbb", "bbbPPPbbbbPPPPbb", "bbbbbbbbbbbbbbbb"] + HEAD_UP[10:]
KEY = {'J': 13, 'b': HEAD, 'i': EARIN, 'I': IRIS, 'P': PUP, 'G': GLINT, 'n': NOSE, 'm': LITE, 'M': MOUTH}

def pose(name):
    m = Map(FS, FS)
    P = POSES[name]
    for pts, w in P['far']:
        m.line(pts, FAR, w)
    m.line(P['tail'], TAIL, 3 if name != 'dash' else 2)
    tx, ty = P['tail'][-1]
    m.ell((tx - 1, ty - 1, tx + 1, ty + 1), TAIL)
    m.ell(P['body'], BODY)
    if 'chest' in P:
        m.ell(P['chest'], CHEST)
    for pts, w in P['near']:
        m.line(pts, LEG, w)
        x, y = pts[-1]
        m.rect((x - 1, y - 1, x + 1, y), PAW)
    hx, hy = P['head']
    m.stamp(P.get('face', HEAD_UP), hx, hy, KEY)
    return m.a

GY = FS - 1
POSES = {
    'idle': dict(body=(8, 20, 26, 30), head=(19, 8), chest=(21, 22, 25, 28),
                 tail=[(9, 24), (6, 22), (4, 18), (4, 14), (6, 11), (8, 10)],
                 far=[([(13, 28), (13, GY)], 2), ([(21, 28), (21, GY)], 2)],
                 near=[([(10, 28), (10, GY)], 3), ([(24, 28), (24, GY)], 3)]),
    'blink': None,
    'run1': dict(body=(5, 19, 25, 28), head=(19, 9),  # толчок: лапы врозь
                 tail=[(6, 22), (3, 19), (2, 16), (2, 12), (3, 10)],
                 far=[([(10, 26), (6, 31), (3, 33)], 2), ([(21, 26), (25, 31), (28, 33)], 2)],
                 near=[([(8, 26), (5, 30), (2, 34)], 3), ([(23, 26), (28, 30), (30, 33)], 3)]),
    'run2': dict(body=(8, 18, 25, 29), head=(19, 8),  # проход: лапы под телом, спина горбом
                 tail=[(9, 21), (5, 18), (3, 14), (4, 10)],
                 far=[([(15, 27), (18, 33)], 2), ([(21, 27), (18, 32)], 2)],
                 near=[([(11, 27), (12, GY)], 3), ([(24, 27), (23, GY)], 3)]),
    'run3': dict(body=(5, 18, 25, 27), head=(19, 7),  # полёт: тело вытянуто, над землёй
                 tail=[(6, 21), (3, 18), (2, 15), (3, 12)],
                 far=[([(10, 25), (5, 28), (2, 28)], 2), ([(21, 25), (27, 27), (30, 26)], 2)],
                 near=[([(8, 25), (4, 29), (2, 30)], 3), ([(23, 25), (29, 28), (32, 27)], 3)]),
    'dash': dict(body=(3, 20, 27, 28), head=(19, 11), face=HEAD_DASH,
                 tail=[(4, 23), (1, 22)],
                 far=[([(8, 26), (3, 29), (1, 29)], 2), ([(23, 26), (30, 29), (32, 29)], 2)],
                 near=[([(7, 26), (2, 28)], 3), ([(24, 26), (31, 28), (33, 28)], 3)]),
}
POSES['blink'] = dict(POSES['idle'], face=HEAD_BLINK)

# A: чёрный с тёплой кромкой; B: рыжий полосатый с кремовым брюшком
SKINS = {
    'A': dict(out='#120b16', base='#2c2236', dark='#1d1526', top='#6a4058', rim='#ff9a5c', rim2='#ffd38a',
              far='#1a1322', lite='#3d3048', paw=None, chest=None, earin='#d0607a', iris='#ffc23a', iris2='#fff27a', pup='#120b16',
              glint='#ffffff', nose='#ef7a92', mouth='#120b16', stripe=None),
    'B': dict(out='#4a1d14', base='#e7843a', dark='#b8562a', top='#ffab5e', rim='#ffd08a', rim2='#fff1c4',
              far='#a9502a', lite='#fff0d4', paw='#fff0d4', chest='#fff0d4', earin='#f39aa2', iris='#6cc84a', iris2='#c8f58a', pup='#1d1418',
              glint='#ffffff', nose='#e86a7e', mouth='#7a3020', stripe='#b8562a'),
}

def paint(a, s):
    h, w = a.shape
    out = np.zeros((h, w, 4), np.uint8)
    fur = np.isin(a, [BODY, HEAD, TAIL, LEG, CHEST])
    trunk = np.isin(a, [BODY, HEAD, CHEST])
    furmap = np.where(fur | (a == FAR) | (a == PAW), 1, 0)
    base = {CHEST: s['chest'] or s['base'], BODY: s['base'], HEAD: s['base'], TAIL: s['base'], LEG: s['base'], IRIS2: s['iris2'], FAR: s['far'], LITE: s['lite'],
            PAW: s['paw'] or s['base'], EARIN: s['earin'], IRIS: s['iris'], PUP: s['pup'],
            GLINT: s['glint'], NOSE: s['nose'], MOUTH: s['mouth']}
    for k, col in base.items():
        out[a == k] = C(col)
    # тень снизу: 2 нижних пикселя меха над пустотой
    below1 = neighbors_empty(a, 0, 1)
    below2 = np.zeros_like(below1); below2[:-1] = below1[1:] & (a[:-1] > 0)
    for msk in (below1, below2):
        out[msk & fur] = C(s['dark'])
    # шов голова/тело — тёмная линия под подбородком
    chin = np.zeros_like(fur); chin[1:] = (a[:-1] == HEAD) & np.isin(a[1:], [BODY, LITE, LEG])
    out[chin] = C(s['dark'])
    # полосы рыжего: поперёк спины и хвоста
    if s['stripe']:
        xs = np.arange(w)[None, :].repeat(h, 0); ys = np.arange(h)[:, None].repeat(w, 1)
        band = ((xs + ys // 3) % 4 == 0)
        top3 = np.zeros_like(fur)
        for y in range(h):
            for x in range(w):
                if a[y, x] in (BODY, TAIL) and all(a[y - k, x] in (BODY, TAIL, 0) for k in range(1, 4) if y - k >= 0) \
                        and any(y - k < 0 or a[y - k, x] == 0 for k in range(1, 5)):
                    top3[y, x] = True
        out[band & top3 & ~below1] = C(s['stripe'])
        hd = (a == HEAD); hy, hx = np.nonzero(hd)
        if len(hy):  # «М» на лбу
            t = hy.min() + 5
            for dx in (5, 7, 9):
                x0 = hx.min() + dx
                if a[t, x0] == HEAD: out[t, x0] = C(s['stripe'])
    # кромка: свет сверху (top) и солнце справа-сверху (rim)
    top = neighbors_empty(a, 0, -1) & trunk
    right = neighbors_empty(a, 1, 0) & trunk
    out[top] = C(s['top'])
    out[right & ~below1] = C(s['rim'])
    out[top & right] = C(s['rim2'])
    out[(a == FAR) & neighbors_empty(a, 0, -1)] = C(s['dark'])
    om = outline_mask(a)
    out[om] = C(s['out'])
    return Image.fromarray(out, 'RGBA')

def speed(img, s):
    """Рывок: штрихи скорости за спиной — цвет кромки, без контура."""
    for y, x0, x1 in ((17, 3, 12), (31, 0, 9), (25, 0, 2)):
        for x in range(x0, x1):
            if img.getpixel((x, y))[3] == 0: img.putpixel((x, y), C(s['rim2'] if x > x0 + 2 else s['rim']))
    return img

def frames(skin, names=('idle', 'blink', 'run1', 'run2', 'run3', 'dash')):
    out = {n: paint(pose(n), SKINS[skin]) for n in names}
    if 'dash' in out: speed(out['dash'], SKINS[skin])
    return out

def sheet(skin, names):
    fr = frames(skin, names)
    s = Image.new('RGBA', (FS * len(names), FS), (0, 0, 0, 0))
    for i, n in enumerate(names):
        s.alpha_composite(fr[n], (i * FS, 0))
    return s

if __name__ == '__main__':
    import sys
    from pix import up
    names = ('idle', 'blink', 'run1', 'run2', 'run3', 'dash')
    rows = [sheet(k, names) for k in 'AB']
    bg = Image.new('RGBA', (FS * len(names), FS * 2), C('#8a7f8f'))
    for i, r in enumerate(rows):
        bg.alpha_composite(r, (0, i * FS))
    up(bg, 6).save(sys.argv[1])
