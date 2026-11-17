"""Макет кадра гл.2 «Дома»: логическая сетка 480x270, показ x2. Собран из тех же функций, что и ассеты
(room.py, furniture.py), — эталон и игра не расходятся. `cd game/art && python3 ref/home_scene.py`.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image
from px import up
import room, furniture, ledges, cat, poses, foes, pickups

GY, FW, FH = 215, 480, 270

def put(img, spr, x, a=0):
    """Спрайт низом на высоте a над полом, центр по x."""
    img.alpha_composite(spr, (x - spr.width // 2, GY - a - spr.height))

def frame(x0=96, lamp=192, pit=(450, 530)):
    """Кусок комнаты с x0 (в логических px): торшер, окно, диван, полка, яма у правого края."""
    img = Image.new('RGBA', (FW, FH), (0, 0, 0, 255))
    w = room.wall()
    for x in range(-(x0 % room.WALL_W), FW, room.WALL_W):
        img.alpha_composite(w, (x, GY - room.WALL_H))
    g = room.glow()
    img.alpha_composite(g, (lamp - x0 - g.width // 2, GY - g.height))
    fl = room.floor(); col = lambda f: fl.crop((f * 16, 0, f * 16 + 16, 64))
    for i, x in enumerate(range(-(x0 % 16), FW, 16)):
        wx = x + x0
        if pit[0] <= wx < pit[1]: f = 5
        else: f = 2 if wx + 16 == pit[0] else 0 if wx == pit[1] else (1, 1, 4, 3)[i % 4]
        img.alpha_composite(col(f), (x, GY))
    F = furniture.build(); X = lambda wx: wx - x0
    put(img, room.window(), X(340), 44)
    put(img, F['prop_picture'].crop((0, 0, 24, 20)), X(256), 96)
    put(img, F['prop_bookshelf'], X(130)); put(img, F['prop_lamp'], X(lamp))
    put(img, F['prop_rug'], X(340)); put(img, F['prop_couch'], X(340)); put(img, F['prop_plant'], X(420))
    put(img, F['prop_tv'], X(520))
    lg = ledges.room()
    img.alpha_composite(lg, (X(232), GY - 45)); img.alpha_composite(lg, (X(470), GY - 75))
    put(img, pickups.heart(), X(256), 60)
    put(img, foes.irrit(1), X(400), 18)
    put(img, cat.frame(poses.idle()[0]), X(168))
    return img

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'ch2_new.png')
    up(frame()).convert('RGB').save(out)
