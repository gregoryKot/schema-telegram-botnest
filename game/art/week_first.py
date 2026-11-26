"""Арт эпилога «Первая встреча»: кабинет терапевта и терапевт в кресле рядом с пустым креслом.
Сбоя тут нет — второго листа у комнаты нет. Превью — кадры «как в игре» (низ кадра от строки 90, x3) и шов плиток."""
from PIL import Image
from px import up
from week_office import FEET
from week_cabinet import cabinet, sprites, FW


def assets():
    return {'bg_wk_cabinet': cabinet(), **sprites()}


def _put(img, spr, x, feet=FEET):
    img.alpha_composite(spr, (x, feet - spr.height + 1))


def _room(m, w=480):
    f = Image.new('RGBA', (w, 270), (0, 0, 0, 255))
    for x in range(0, w, 480):
        sky = Image.new('RGBA', (480, 270), (0, 0, 0, 255)); sky.alpha_composite(m['bg_wk_city_eve'])
        sky.alpha_composite(m['bg_wk_cabinet']); f.alpha_composite(sky, (x, 0))
    return f


def previews(m, c):
    cell = lambda i: m['wk_therapist'].crop((i * FW, 0, (i + 1) * FW, m['wk_therapist'].height))
    phone = lambda f, x=0: up(f.crop((x, 90, x + 320, 270)), 3).convert('RGB')
    far = _room(m); _put(far, c['sasha_run'][2], 40); _put(far, cell(1), 196, FEET + 2)
    near = _room(m); _put(near, c['sasha_idle'][0], 200); _put(near, cell(0), 186, FEET + 2)
    seam = up(_room(m, 960).crop((0, 90, 960, 270)), 2).convert('RGB')
    return {'week_first_far': phone(far), 'week_first_near': phone(near, 90), 'week_first_seam': seam}
