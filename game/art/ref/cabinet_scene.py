"""Макет кадра гл.4 «Первый сеанс»: логическая сетка 480x270, показ x2. Собран из тех же функций, что и
ассеты (cabinet.py, doc.py, furniture.py). `cd game/art && python3 ref/cabinet_scene.py`.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from px import up
import cabinet, furniture, cat, poses, doc

COUCH_X, PLANT_X, SHELF_X = 138, 338, 40    # те же числа, что в game/src/scenes/game/cabinetLayout.ts

def put(img, spr, x, a=0):
    img.alpha_composite(spr, (x - spr.width // 2, cabinet.GY - a - spr.height))

def frame():
    img = cabinet.room()
    F = furniture.build()
    put(img, F['prop_bookshelf'], SHELF_X); put(img, F['prop_plant'], PLANT_X); put(img, F['prop_plant'], 446)
    put(img, F['prop_couch'], COUCH_X)
    put(img, cat.frame(poses.idle()[0]), COUCH_X - 10, round(F['prop_couch'].height * .4))
    put(img, doc.frame().transpose(0), cabinet.CHAIR_X, cabinet.SEAT)   # 0 = FLIP_LEFT_RIGHT: лицом к Мистеру
    return img

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'ch4_new.png')
    up(frame()).convert('RGB').save(out)
