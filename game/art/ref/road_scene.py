"""Макет кадра гл.3 «Дорога»: логическая сетка 480x270, показ x2. Собран из тех же функций, что и ассеты
(road.py, road_ground.py, hawkers.py). `cd game/art && python3 ref/road_scene.py`.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image
from px import up
import road, road_ground, ledges, cat, poses, pickups, hawkers

GY, FW, FH = 215, 480, 270

def put(img, spr, x, a=0):
    img.alpha_composite(spr, (x - spr.width // 2, GY - a - spr.height))

def frame(x0=300, pit=(380, 460)):
    img = Image.new('RGBA', (FW, FH), (0, 0, 0, 255))
    img.alpha_composite(road.dawn_sky(**road.DESK), (0, 0))
    for lay, sf in ((road.far(), .15), (road.mid(), .4), (road.near(), .75)):
        off = int(x0 * sf) % lay.width
        for x in range(-off, FW, lay.width):
            img.alpha_composite(lay, (x, GY - lay.height))
    g = road_ground.sheet(); col = lambda f: g.crop((f * 16, 0, f * 16 + 16, 64))
    for i, x in enumerate(range(-(x0 % 16), FW, 16)):
        wx = x + x0
        if pit[0] <= wx < pit[1]: f = 5
        else: f = 2 if wx + 16 == pit[0] else 0 if wx == pit[1] else (1, 1, 4, 3)[i % 4]
        img.alpha_composite(col(f), (x, GY))
    X = lambda wx: wx - x0
    lg = ledges.street(road.P, '#fff8e8')
    img.alpha_composite(lg, (X(420), GY - 60)); img.alpha_composite(lg, (X(560), GY - 96))
    put(img, road.signpost(), X(520), -3)
    put(img, hawkers.soothe(0), X(600), 10); put(img, hawkers.mirror(0), X(700)); put(img, hawkers.bargainer(0), X(330))
    put(img, pickups.heart(), X(444), 72)
    put(img, cat.frame(poses.run()[1]), X(480))
    return img

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'ch3_new.png')
    up(frame()).convert('RGB').save(out)
