"""Эталон «Недели» на утверждение: лист персонажей и два кадра «как в игре» (обычный офис и сбой).
Пишет только превью в out/ — в game/src/assets ничего не ставит (до «да» владельца на эталон)."""
from PIL import Image
from px import C, up, strip
from cat import pose, paint, SKIN
from poses import IDLE
from week_cast import cast
from week_office import office, door_glitch, near, LANE, VIEW_H, W, DOOR
from week_glitch import warp, tears, bubble, lift

# Мистер в свете «Недели»: вместо закатной кромки — нейтральная
CAT_SKIN = dict(SKIN, top='#5a5560', rim='#8c8c90', rim2='#b6b6ba')

def cat():
    return paint(pose(IDLE), CAT_SKIN)

def _put(img, spr, x, feet_y):
    img.alpha_composite(spr, (x, feet_y - spr.height + 1))

def shadow(img, x, y, w=22):
    px = img.load()
    for i in range(x - w // 2, x + w // 2):
        for j in (y, y + 1):
            if (i + j) % 2 == 0 and 0 <= i < img.width and 0 <= j < img.height:
                px[i, j] = C('#8c8880')

def frame_calm(c):
    img = office()
    for x, key in ((118, 'kollega_b'), (190, 'sasha_stand'), (330, 'kollega_a')):
        shadow(img, x + 21, LANE); _put(img, c[key], x, LANE)
    near(img)
    return img.crop((0, 0, W, VIEW_H))

def frame_glitch(c):
    img = tears(warp(office(glitch=True)))
    door_glitch(img, lift(DOOR[0] + 16))
    for x, spr in ((120, c['kollega_b_blank']), (170, c['kollega_a_blank']), (250, c['sasha_run'][3])):
        y = LANE - lift(x + 21)
        shadow(img, x + 21, y); _put(img, spr, x, y)
    for x, y, w, h in ((176, 96, 30, 16), (300, 52, 36, 20), (262, 128, 26, 14), (346, 150, 30, 16), (372, 84, 22, 12), (214, 40, 24, 12)):
        img.alpha_composite(bubble(w, h), (x, y))
    near(img)
    return img.crop((0, 0, W, VIEW_H))

def sheet(c):
    """Лист персонажей: все в одном масштабе, Мистер — мерка."""
    row = [c['sasha_stand'], c['sasha_pause'], c['sasha_run'][0], c['sasha_run'][3], c['kollega_a'], c['kollega_a_blank'],
           c['kollega_b'], c['kollega_b_blank']]
    s = Image.new('RGBA', (len(row) * 50 + 110, 100), C('#dcd6c8'))
    for y in range(88, 100):
        for x in range(s.width):
            s.putpixel((x, y), C('#b8b2a6' if y > 88 else '#6e6a66'))
    for i, f in enumerate(row):
        _put(s, f, 6 + i * 50, 88)
    _put(s, c['boss'], len(row) * 50 + 8, 88)
    _put(s, cat(), len(row) * 50 + 62, 88)
    return s

def build(out='out'):
    c = cast()
    made = {'week_cast': sheet(c), 'week_office_calm': frame_calm(c), 'week_office_glitch': frame_glitch(c),
            'week_sasha_run': strip(c['sasha_run'])}
    for k, img in made.items():
        bg = Image.new('RGBA', img.size, C('#dcd6c8')); bg.alpha_composite(img)
        up(bg, 3 if k == 'week_sasha_run' else 2).convert('RGB').save(f'{out}/{k}.png')
    return made

if __name__ == '__main__':
    build()
