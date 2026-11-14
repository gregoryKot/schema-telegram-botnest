"""Собрать ассеты волны 1 и лист-эталон: `cd game/art && python3 build.py [--install]`.
Всегда пишет game/art/out/ (эталон, превью); с --install — ещё game/src/assets/.
Базовый кот перекрашивается из исходников src/*_src.png (старые листы), поэтому
сборка повторяема."""
import os
import sys
from PIL import Image
from px import save, check
from cat import restyle
import poses, ground, ledges, street, refs, light, doc

ASSETS, OUT = '../src/assets', 'out'

def main():
    os.makedirs(OUT, exist_ok=True)
    made = {k: restyle(f'src/{k}_src.png') for k in ('cat_idle', 'cat_run')}
    for mod in (poses, ground, ledges, street, light, doc):
        made.update(mod.build())
    for k, img in made.items():
        check(img, k)
        if '--install' in sys.argv:
            save(img, f'{ASSETS}/{k}.png')
    sheet = preview(made)
    save(sheet, f'{OUT}/wave1.png', limit=255)
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
