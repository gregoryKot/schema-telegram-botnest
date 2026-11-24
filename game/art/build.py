"""Собрать ассеты игры: `cd game/art && python3 build.py [--install]`.
Всегда пишет превью «Недели» в game/art/out/ (не в git); с --install — ещё game/src/assets/."""
import os
import sys
from px import save, check
import week

ASSETS, OUT = '../src/assets', 'out'

def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    made.update(week.build(OUT))                        # «Неделя»: арт хука и превью-кадры
    for k, img in made.items():
        limit = 64 if k.startswith('bg_') else 32    # фоны: дымка множит оттенки
        check(img, k, limit)
        if '--install' in sys.argv:
            save(img, f'{ASSETS}/{k}.png', limit)
    print('\n'.join(f'{k}: {v.size}' for k, v in made.items()))

if __name__ == '__main__':
    main()
