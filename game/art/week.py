"""Арт хука «Недели» («Понедельник. Офис»): люди, фоны, вещи. `build()` отдаёт ассеты по именам файлов
и пишет в out/ превью — кадры «как в игре» в размере телефона (виден низ кадра от строки 90)."""
from PIL import Image
from px import up, strip
from week_cast import cast
from week_city import city
from week_office import office, FEET, ACID
from week_street import street, home
from week_props import props
from week_corridor import corridor, boss_room, arch, DOOR_X
import week_wed
import week_fri
import week_sun
import week_first

SHEETS = ('idle', 'walk', 'run', 'phone', 'air', 'dash', 'still')

def assets():
    c = cast()
    made = {'bg_wk_city': city(), 'bg_wk_office': office(), 'bg_wk_office_glitch': office(True),
            'bg_wk_street': street(), 'bg_wk_home': home(), 'bg_wk_corridor': corridor(),
            'bg_wk_corridor_glitch': corridor(True), 'bg_wk_boss_room': boss_room(), 'wk_arch': arch()}
    for k in SHEETS:
        made['wk_sasha_' + k] = strip(c['sasha_' + k]); made[f'wk_sasha_{k}_heavy'] = strip(c[f'sasha_{k}_heavy'])
    for k in ('colleague_a', 'colleague_b', 'colleague_c', 'colleague_box', 'boss'):
        made['wk_' + k] = strip(c[k])
    made.update(props()); made.update(week_wed.assets())          # «Среда. Звонок маме»
    made.update(week_fri.assets())                                 # «Пятница. Вечеринка»
    made.update(week_sun.assets())                                 # «Воскресенье. Тишина»
    made.update(week_first.assets())                               # «Первая встреча»
    return made, c

def _put(img, spr, x, feet=FEET):
    img.alpha_composite(spr, (x, feet - spr.height + 1))

def _frame(layers, tint=None):
    f = Image.new('RGBA', (480, 270), (0, 0, 0, 255))
    f.alpha_composite(layers[0])
    if tint:
        f = Image.blend(f, Image.new('RGBA', f.size, tint), 0.55)
    for l, x in layers[1:]:
        f.alpha_composite(l, (x, 0))
    return f

def previews(made, c):
    m = made; cell = lambda key, i, w: m[key].crop((i * w, 0, (i + 1) * w, m[key].height))
    morning = _frame([m['bg_wk_city'], (m['bg_wk_home'], 0), (m['bg_wk_street'], 180)])
    morning.alpha_composite(cell('wk_mister', 0, 36), (2, 145)); _put(morning, c['sasha_walk'][1], 70)
    street_f = _frame([m['bg_wk_city'], (m['bg_wk_street'], 0)])
    _put(street_f, m['wk_curb'], 150); _put(street_f, c['sasha_air'][0], 100, FEET - 20); _put(street_f, m['wk_puddle'], 236, FEET + 4)
    _put(street_f, m['wk_step'], 262); _put(street_f, m['wk_step_hi'], 297)
    calm = _frame([m['bg_wk_city'], (m['bg_wk_office'], 0)])
    for x, spr in ((40, c['sasha_walk'][3]), (150, c['colleague_c'][0]), (216, c['colleague_b'][0])):
        _put(calm, spr, x)
    _put(calm, cell('wk_door', 0, 34), 270)
    glitch = _frame([m['bg_wk_city'], (m['bg_wk_office_glitch'], 0)], tint=(70, 20, 120, 255))
    _put(glitch, cell('wk_piles', 1, 26), 96); _put(glitch, cell('wk_piles', 5, 26), 150); _put(glitch, m['wk_notif_wall'], 190)
    _put(glitch, c['sasha_run'][2], 40); _put(glitch, c['colleague_box'][1], 236); _put(glitch, cell('wk_door', 1, 34), 282)
    phone = lambda f, x=0: up(f.crop((x, 90, x + 320, 270)), 3).convert('RGB')
    sheet = Image.new('RGBA', (40 * 20, 124), (0x9f, 0xb4, 0xc0, 255))
    sheet.alpha_composite(strip(c['sasha_idle'][:1] + c['sasha_walk'][:3] + c['sasha_run'] + c['sasha_phone'][:2] + c['sasha_air']
                                + c['sasha_dash'][:1] + c['sasha_still'][:3]), (0, 0))
    sheet.alpha_composite(strip(c['sasha_run_heavy'][:2] + c['colleague_a'] + c['colleague_b'] + c['colleague_c']
                                + c['colleague_box'][:2] + c['boss']), (0, 62))
    return {**halls(m, c, cell), 'week_morning': phone(morning), 'week_street': phone(street_f), 'week_office_calm': phone(calm),
            'week_office_glitch': phone(glitch), 'week_cast': up(sheet, 3).convert('RGB')}

def halls(m, c, cell):
    """Коридор: опенспейс | портал | плитка x2 (виден шов плиток), сбой; кабинет начальницы со вставкой и дверью."""
    wide = lambda f: up(f.crop((0, 90, f.width, 270)), 2).convert('RGB')
    out = {}
    for tag, g in (('calm', ''), ('glitch', '_glitch')):
        f = Image.new('RGBA', (960, 270), (0, 0, 0, 255))
        for x in (0, 480):
            f.alpha_composite(_frame([m['bg_wk_city']], (70, 20, 120, 255) if g else None), (x, 0))
        f.alpha_composite(m['bg_wk_office' + g].crop((240, 0, 480, 270)), (0, 0))
        f.alpha_composite(m['bg_wk_corridor' + g], (240, 0)); f.alpha_composite(m['bg_wk_corridor' + g].crop((0, 0, 240, 270)), (720, 0))
        _put(f, m['wk_arch'], 240 - 14)
        _put(f, c['sasha_run'][2], 300); _put(f, cell('wk_piles', 2, 26), 520); _put(f, cell('wk_piles', 4, 26), 700)
        _put(f, cell('wk_door', 1 if g else 0, 34), 860)
        out['week_corridor_' + tag] = wide(f)
    room = _frame([m['bg_wk_city'], (m['bg_wk_corridor'], 0), (m['bg_wk_boss_room'], 240)])
    _put(room, cell('wk_door', 0, 34), 240 + DOOR_X - 17); _put(room, c['sasha_walk'][2], 170)
    out['week_boss_room'] = wide(room)
    return out

def build(out='out'):
    made, c = assets()
    for k, img in {**previews(made, c), **week_wed.previews(made, c), **week_fri.previews(made, c), **week_sun.previews(made, c), **week_first.previews(made, c)}.items():
        img.save(f'{out}/{k}.png')
    return made

if __name__ == '__main__':
    build()
