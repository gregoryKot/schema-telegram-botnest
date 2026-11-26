"""Арт главы «Среда. Звонок маме»: вечерняя квартира и её сбой, город в сумерках, мама на экране,
стена звонка, телефон-цель. Превью — кадры «как в игре» (низ кадра от строки 90, x3), шов плиток и лист вещей."""
from PIL import Image
from px import up
from week_city import city_eve
from week_flat import flat
from week_mom import sprites
from week_office import FEET

GLITCH_TINT = (70, 20, 120, 255)


def assets():
    return {'bg_wk_city_eve': city_eve(), 'bg_wk_flat': flat(), 'bg_wk_flat_glitch': flat(True), **sprites()}


def _put(img, spr, x, feet=FEET):
    img.alpha_composite(spr, (x, feet - spr.height + 1))


def _room(m, key, tint=None, w=480):
    f = Image.new('RGBA', (w, 270), (0, 0, 0, 255))
    for x in range(0, w, 480):
        sky = Image.new('RGBA', (480, 270), (0, 0, 0, 255)); sky.alpha_composite(m['bg_wk_city_eve'])
        if tint:
            sky = Image.blend(sky, Image.new('RGBA', sky.size, tint), 0.55)
        sky.alpha_composite(m[key]); f.alpha_composite(sky, (x, 0))
    return f


def previews(m, c):
    cell = lambda key, i, w: m[key].crop((i * w, 0, (i + 1) * w, m[key].height))
    phone = lambda f: up(f.crop((0, 90, 320, 270)), 3).convert('RGB')
    calm = _room(m, 'bg_wk_flat')
    calm.alpha_composite(cell('wk_mister', 1, 36), (40, 135))          # Мистер на подоконнике
    _put(calm, c['sasha_walk'][2], 150); _put(calm, cell('wk_mom_call', 0, 34), 268)
    glitch = _room(m, 'bg_wk_flat_glitch', GLITCH_TINT)
    _put(glitch, c['sasha_run'][2], 34); _put(glitch, cell('wk_piles', 2, 26), 92); _put(glitch, m['wk_call_wall'], 136)
    _put(glitch, cell('wk_mom_screen', 1, 40), 196); _put(glitch, up(cell('wk_mom_call', 1, 34), 2), 252)
    seam = Image.new('RGBA', (960, 360), (0, 0, 0, 255))
    seam.alpha_composite(_room(m, 'bg_wk_flat', w=960).crop((0, 90, 960, 270)), (0, 0))
    seam.alpha_composite(_room(m, 'bg_wk_flat_glitch', GLITCH_TINT, 960).crop((0, 90, 960, 270)), (0, 180))
    keys = (('wk_mom_screen', 40), ('wk_call_wall', 40), ('wk_mom_call', 34))
    sheet = Image.new('RGBA', (sum(m[k].width + 8 for k, _ in keys) + 8, 140), (0x9f, 0xb4, 0xc0, 255)); x = 8
    for k, _ in keys:
        sheet.alpha_composite(m[k], (x, 136 - m[k].height)); x += m[k].width + 8
    return {'week_wed_calm': phone(calm), 'week_wed_glitch': phone(glitch), 'week_wed_seam': up(seam, 2).convert('RGB'),
            'week_wed_props': up(sheet, 4).convert('RGB')}
