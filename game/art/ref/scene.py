"""Сборка кадра главы 1: логическая сетка 480x270, показ x2 = 960x540; HUD — из текущего скриншота."""
import sys
import numpy as np
from PIL import Image, ImageDraw
from pix import C, up
from pal import CH1 as P
import sky, city, near, props, enemy, cat2
from city import GY

PIT = (398, 446)
LEDGE = (190, 168)
LAMP_X = 330
CAT = (86, 'run1')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '../../shots'

def shadow(d, x0, x1):
    """Длинная тень влево по верху тротуара (солнце справа, низко)."""
    for dy, k in ((2, 0), (3, 3), (4, 8)):
        d.line((x0 + k, GY + dy, x1 - k // 2, GY + dy), fill=C(P['pave']))

def world(cat=True, enemy_on=True):
    img = sky.sky()
    for layer in (city.far(), city.mid(), near.near()):
        img.alpha_composite(layer)
    img.alpha_composite(props.ground(PIT))
    d = ImageDraw.Draw(img)
    shadow(d, LAMP_X - 54, LAMP_X)
    shadow(d, 236, 282)  # тень дерева
    props.lamp(d, LAMP_X)
    props.lamp_glow(img, LAMP_X)
    props.lamp(ImageDraw.Draw(img), LAMP_X)  # железо поверх ореола
    lx, ly = LEDGE
    props.ledge_shadow(img, lx + 2, ly + 11, 46)
    img.alpha_composite(props.ledge(), (lx, ly))
    props.flowers(d, lx + 3, ly - 1)
    # сердце над уступом + искры
    img.alpha_composite(props.heart(), (lx + 17, ly - 26))
    props.sparkle(d, lx + 14, ly - 27); props.sparkle(d, lx + 34, ly - 16, big=False)
    # Тревога зависла над ямой, смотрит на кота
    if enemy_on:
        img.alpha_composite(enemy.anx(), (PIT[0] - 2, 150))
    # кот: тень + пыль из-под лап
    if not cat:
        return img
    cx, pose = CAT
    shadow(d, cx - 20, cx + 22)
    for px_, py_, c in [(cx + 2, GY - 3, '#ffe0b8'), (cx - 2, GY - 2, '#ffe0b8'), (cx - 1, GY - 4, '#f0b48c'),
                        (cx - 6, GY - 2, '#f0b48c'), (cx + 1, GY - 2, '#f0b48c')]:
        d.point((px_, py_), fill=C(c))
    img.alpha_composite(cat2.frames('A', (pose,))[pose], (cx, GY - 1 - cat2.FS + 1))
    return img

def hud(frame, shots):
    """Сердца, счётчик и кнопка меню — как есть, вырезаны из текущего кадра (яркое + тёмная обводка)."""
    src = np.array(Image.open(f'{shots}/ch1.png').convert('RGBA')).astype(int)
    out = np.array(frame)
    x0, y0, x1, y1 = 8, 6, 120, 72
    crop = src[y0:y1, x0:x1]
    bright = crop[..., :3].max(-1) > 150
    near = bright.copy()
    for dx in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            near |= np.roll(np.roll(bright, dy, 0), dx, 1)
    keep = bright | (near & (crop[..., :3].sum(-1) < 75))
    out[y0:y1, x0:x1][keep] = crop[keep].astype(np.uint8)
    out[6:64, 888:952] = src[6:64, 888:952].astype(np.uint8)  # кнопка меню целиком
    return Image.fromarray(out, 'RGBA')

def build(shots=SHOTS):
    return hud(up(world(), 2), shots)

if __name__ == '__main__':
    build().convert('RGB').save(sys.argv[2] if len(sys.argv) > 2 else 'ch1_test.png')
