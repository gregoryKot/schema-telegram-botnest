"""Зона Телефона гл.2: пунктирное кольцо холодного света экрана и редкие точки внутри — без векторной
заливки. 4 кадра 176x176: кольцо «дышит» (радиус 76…84 px арта), в игре показ x2."""
import math
from PIL import Image
from px import C, strip
from tile import BAYER4

SIZE, RADII = 176, (76, 79, 82, 84)
RING, DOT = '#6ab4ff', '#4a8ad8'

def frame(r):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)); c = SIZE / 2 - .5
    for y in range(SIZE):
        for x in range(SIZE):
            d = math.hypot(x - c, y - c)
            if abs(d - r) < .6:
                if int((math.atan2(y - c, x - c) + math.pi) * 28 / math.pi) % 3: img.putpixel((x, y), C(RING))
            elif d < r - 2 and x % 2 == 0 and y % 2 == 0 and BAYER4[y // 2 % 4, x // 2 % 4] < .04 + .3 * (d / r) ** 4:
                img.putpixel((x, y), C(DOT))                  # свет экрана гуще к краю зоны
    return img

def build():
    return {'fx_phone_zone': strip([frame(r) for r in RADII])}
