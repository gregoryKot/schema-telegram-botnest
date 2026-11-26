"""Арт главы «Пятница. Вечеринка»: квартира друзей и её сбой, пол-конвейер к выходу, гости в масках,
Женя с тортом, горы посуды, стена масок. Превью — кадры «как в игре» (низ кадра от строки 90, x3), шов и лист."""
from PIL import Image
from px import up
from week_guests import sprites
from week_office import FEET
from week_party import party, exit_floor

GLITCH_TINT = (70, 20, 120, 255)


def assets():
    return {'bg_wk_party': party(), 'bg_wk_party_glitch': party(True), 'bg_wk_exit_floor': exit_floor(), **sprites()}


def _put(img, spr, x, feet=FEET):
    img.alpha_composite(spr, (x, feet - spr.height + 1))


def _room(m, key, tint=None, w=480):
    f = Image.new('RGBA', (w, 270), (0, 0, 0, 255))
    for x in range(0, w, 480):
        sky = Image.new('RGBA', (480, 270), (0, 0, 0, 255)); sky.alpha_composite(m['bg_wk_city_eve'])
        if tint:
            sky = Image.blend(sky, Image.new('RGBA', sky.size, tint), 0.55)
        sky.alpha_composite(m[key])
        if tint:
            sky.alpha_composite(m['bg_wk_exit_floor'], (0, 219))
        f.alpha_composite(sky, (x, 0))
    return f


def previews(m, c):
    cell = lambda key, i, w: m[key].crop((i * w, 0, (i + 1) * w, m[key].height))
    phone = lambda f: up(f.crop((0, 90, 320, 270)), 3).convert('RGB')
    calm = _room(m, 'bg_wk_party')
    _put(calm, c['sasha_walk'][2], 40); _put(calm, cell('wk_guest_a', 0, 40), 96); _put(calm, cell('wk_guest_b', 0, 40), 150)
    _put(calm, cell('wk_guest_c', 0, 40), 204); _put(calm, cell('wk_friend_cake', 0, 34), 270)
    glitch = _room(m, 'bg_wk_party_glitch', GLITCH_TINT)
    _put(glitch, c['sasha_run'][2], 30); _put(glitch, cell('wk_dishes', 2, 26), 84); _put(glitch, cell('wk_guest_a', 1, 40), 112)
    _put(glitch, m['wk_mask_wall'], 156); _put(glitch, cell('wk_guest_ask', 1, 40), 204); _put(glitch, cell('wk_friend_cake', 1, 34), 276)
    seam = Image.new('RGBA', (960, 360), (0, 0, 0, 255))
    seam.alpha_composite(_room(m, 'bg_wk_party', w=960).crop((0, 90, 960, 270)), (0, 0))
    seam.alpha_composite(_room(m, 'bg_wk_party_glitch', GLITCH_TINT, 960).crop((0, 90, 960, 270)), (0, 180))
    keys = ('wk_guest_a', 'wk_guest_b', 'wk_guest_c', 'wk_guest_ask', 'wk_friend_cake', 'wk_dishes', 'wk_mask_wall')
    sheet = Image.new('RGBA', (sum(m[k].width + 8 for k in keys) + 8, 140), (0x9f, 0xb4, 0xc0, 255)); x = 8
    for k in keys:
        sheet.alpha_composite(m[k], (x, 136 - m[k].height)); x += m[k].width + 8
    return {'week_fri_calm': phone(calm), 'week_fri_glitch': phone(glitch), 'week_fri_seam': up(seam, 2).convert('RGB'),
            'week_fri_props': up(sheet, 2).convert('RGB')}
