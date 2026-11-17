"""Листы эталона: варианты кота, до/после, палитры. Подписи — шрифтом игры (PS2P)."""
from PIL import Image, ImageDraw, ImageFont
from pix import C, up
import cat2, scene, pal
from city import GY

FONTS = '/home/user/schema-telegram-botnest/game/public/fonts/ps2p-'
_f = {}
def font(sz, cyr):
    k = (sz, cyr)
    if k not in _f: _f[k] = ImageFont.truetype(FONTS + ('cyrillic' if cyr else 'latin') + '.woff2', sz)
    return _f[k]

def text(d, xy, s, sz=16, col='#fff4e0', shadow='#2a1424'):
    x, y = xy
    for ch in s:
        f = font(sz, ord(ch) >= 0x400)
        if shadow: d.text((x + 2, y + 2), ch, font=f, fill=C(shadow))
        d.text((x, y), ch, font=f, fill=C(col))
        x += f.getlength(ch)
    return x

NAMES = ('idle', 'blink', 'run1', 'run2', 'run3', 'dash')
LABELS = ('покой', 'моргнул', 'бег 1', 'бег 2', 'бег 3', 'рывок')

def cat_options(path):
    k, fs = 4, cat2.FS
    cell = fs * k
    bgworld = scene.world(cat=False, enemy_on=False)
    half_w = 3 * cell + 4 * 12
    W = 2 * half_w + 60; H = 90 + 2 * (2 * cell + 2 * 30 + 40) + 40
    out = Image.new('RGBA', (W, H), C('#211a2c')); d = ImageDraw.Draw(out)
    text(d, (30, 24), 'Мистер: два варианта окраса, кадр 36x36, показ x4', 16)
    for col, skin in enumerate('AB'):
        fr = cat2.frames(skin, NAMES)
        x0 = 30 + col * (half_w + 10)
        title = 'A: чёрный + тёплая кромка' if skin == 'A' else 'B: рыжий полосатый'
        text(d, (x0, 66), title, 12, '#ffd27a')
        for row, mode in enumerate(('нейтральный фон', 'фон главы 1')):
            y0 = 96 + row * (2 * cell + 2 * 30 + 40)
            text(d, (x0, y0), mode, 10, '#c8b8d8')
            for i, n in enumerate(NAMES):
                cx, cy = x0 + (i % 3) * (cell + 12), y0 + 20 + (i // 3) * (cell + 30)
                if mode.startswith('нейтр'):
                    tile = Image.new('RGBA', (fs, fs), C('#857a8c'))
                else:
                    bx = 96 + i * 44
                    tile = bgworld.crop((bx, GY - fs + 1, bx + fs, GY + 1)).copy()
                tile.alpha_composite(fr[n])
                out.alpha_composite(up(tile, k), (cx, cy))
                text(d, (cx, cy + cell + 6), LABELS[i], 10, '#fff4e0')
    out.convert('RGB').save(path)

def before_after(path, new, shots):
    old = Image.open(f'{shots}/ch1.png').convert('RGBA')
    W, H = 960, 540 * 2 + 3 * 44
    out = Image.new('RGBA', (W, H), C('#211a2c')); d = ImageDraw.Draw(out)
    text(d, (16, 14), 'сейчас', 18, '#c8b8d8')
    out.alpha_composite(old, (0, 44))
    text(d, (16, 44 + 540 + 14), 'эталон', 18, '#ffd27a')
    out.alpha_composite(new, (0, 2 * 44 + 540))
    out.convert('RGB').save(path)

GROUPS1 = [('небо', 'sky'), ('солнце, облака', ('sun', 'cl_')), ('дальний план', 'far'),
           ('средний план, окна', ('mid', 'win', 'haze')), ('ближний план', ('near', 'leaf')),
           ('земля', ('curb', 'pave', 'wall', 'soil')), ('контур', 'ink')]

def palette(path):
    mono = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 9)
    rows = [('глава 1: тёплый вечер (золотой час)', None)]
    rows += [('  ' + g, [c for k, c in pal.CH1.items() if k.startswith(pre)]) for g, pre in GROUPS1]
    rows += [('глава 2: дом вечером', None), ('', list(pal.CH2.values())),
             ('терапия: рассвет и утро (намёк)', None), ('', list(pal.DAWN.values()))]
    sw, lx = 40, 230
    W = lx + 18 * sw + 20
    H = 20 + sum(34 if c is None else sw + 22 for _, c in rows) + 10
    out = Image.new('RGBA', (W, H), C('#211a2c')); d = ImageDraw.Draw(out)
    y = 16
    for title, cols in rows:
        if cols is None:
            text(d, (20, y + 8), title, 12, '#ffd27a'); y += 34; continue
        if title: text(d, (20, y + 12), title.strip(), 8, '#c8b8d8', None)
        x0 = lx if title else 20
        for i, c in enumerate(cols):
            x = x0 + i * sw
            d.rectangle((x, y, x + sw - 4, y + sw - 4), fill=C(c))
            d.text((x, y + sw - 2), c[1:], font=mono, fill=C('#c8b8d8'))
        y += sw + 22
    out.convert('RGB').save(path)

if __name__ == '__main__':
    import sys
    ref, shots = sys.argv[1], sys.argv[2]
    new = scene.build(shots)
    new.convert('RGB').save(f'{ref}/ch1_new.png')
    cat_options(f'{ref}/cat_options.png')
    before_after(f'{ref}/before_after.png', new, shots)
    palette(f'{ref}/palette.png')
