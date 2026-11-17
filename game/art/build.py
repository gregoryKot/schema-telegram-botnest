"""Собрать ассеты волны 1 и лист-эталон: `cd game/art && python3 build.py [--install]`.
Всегда пишет game/art/out/ (эталон, превью); с --install — ещё game/src/assets/.
Кот целиком рисуется ригом (cat.py, poses.py) — исходных картинок нет, сборка повторяема."""
import os
import sys
from PIL import Image
from px import save, check
import poses, ground, ledges, street, sky, refs, light, doc, foes, pickups, room, furniture, bedroom, home_foes, road, hawkers

ASSETS, OUT = '../src/assets', 'out'

def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for mod in (poses, ground, ledges, sky, street, light, doc, foes, pickups, room, furniture, bedroom, home_foes, road, hawkers):
        made.update(mod.build())
    for k, img in made.items():
        limit = 64 if k.startswith('bg_') else 32    # фоны: дымка множит оттенки
        check(img, k, limit)
        if '--install' in sys.argv:
            save(img, f'{ASSETS}/{k}.png', limit)
    sheet = preview(made)
    sheet.convert('RGB').save(f'{OUT}/wave1.png')       # превью: цветов больше, чем в индексной PNG
    ref = refs.sheet()
    save(ref.resize((ref.width * 2, ref.height * 2), Image.NEAREST), f'{OUT}/reference.png', limit=255)
    print('\n'.join(f'{k}: {v.size}' for k, v in made.items()))

def preview(made):
    """Контактный лист волны 1 на фоне ночи, x2."""
    items = list(made.values())
    w = max(i.width for i in items) + 8
    h = sum(i.height + 6 for i in items) + 6
    s = Image.new('RGBA', (w, h), (0x2c, 0x23, 0x48, 255))
    y = 6
    for i in items:
        s.alpha_composite(i, (4, y)); y += i.height + 6
    return s.resize((w * 2, h * 2), Image.NEAREST)

if __name__ == '__main__':
    main()
