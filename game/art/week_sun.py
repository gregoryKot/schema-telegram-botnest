"""Арт главы «Воскресенье. Тишина»: своя квартира днём, её тихая пустота и маленький Саша в конце.
Превью — кадры «как в игре» (низ кадра от строки 90, x3) и шов плиток."""
from PIL import Image
from px import up
from week_little import sprites
from week_office import FEET
from week_quiet import quiet, void

VOID_TINT = (70, 20, 120, 255)


def assets():
    room = quiet()
    return {'bg_wk_quiet': room, 'bg_wk_quiet_void': void(room), **sprites()}


def _put(img, spr, x, feet=FEET):
    img.alpha_composite(spr, (x, feet - spr.height + 1))


def _room(m, key, tint=None, w=480):
    f = Image.new('RGBA', (w, 270), (0, 0, 0, 255))
    for x in range(0, w, 480):
        sky = Image.new('RGBA', (480, 270), (0, 0, 0, 255)); sky.alpha_composite(m['bg_wk_city'])
        if tint:
            sky = Image.blend(sky, Image.new('RGBA', sky.size, tint), 0.55)
        sky.alpha_composite(m[key]); f.alpha_composite(sky, (x, 0))
    return f


def previews(m, c):
    cell = lambda key, i, w: m[key].crop((i * w, 0, (i + 1) * w, m[key].height))
    phone = lambda f, x=0: up(f.crop((x, 90, x + 320, 270)), 3).convert('RGB')
    calm = _room(m, 'bg_wk_quiet')
    _put(calm, cell('wk_mister', 1, 36), 106); _put(calm, c['sasha_walk'][2], 40)
    empty = _room(m, 'bg_wk_quiet_void', VOID_TINT, 960)
    _put(empty, c['sasha_run'][2], 380); _put(empty, cell('wk_little', 1, 34), 600)
    seam = Image.new('RGBA', (960, 360), (0, 0, 0, 255))
    seam.alpha_composite(_room(m, 'bg_wk_quiet', w=960).crop((0, 90, 960, 270)), (0, 0))
    seam.alpha_composite(empty.crop((0, 90, 960, 270)), (0, 180))
    return {'week_sun_calm': phone(calm), 'week_sun_void': phone(empty, 350), 'week_sun_seam': up(seam, 2).convert('RGB')}
