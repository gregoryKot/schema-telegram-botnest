"""Уличный фонарь (эталон гл.1) со светом внутри спрайта: ореол — дизером по Байеру, альфа только 0/255.
Торшер дома — furniture.py."""
from PIL import Image, ImageDraw
from px import C, PAL
from tile import BAYER4

def streetlamp():
    """Фонарь 32x100 (показ x2, низ на 5 px утоплен в пол): чугун против солнца с тёплой
    кромкой справа, стекло светится, ореол — дизером по Байеру."""
    P = PAL['ch1']
    img = Image.new('RGBA', (32, 100), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    x, g, ly = 16, 95, 9                                  # ось, уровень земли, верх плафона
    for yy in range(ly - 9, ly + 20):                     # ореол вокруг плафона
        for xx in range(32):
            dd = ((xx - x) ** 2 + (yy - ly - 5) ** 2) ** .5
            if dd < 14 and BAYER4[yy % 4, xx % 4] < (14 - dd) / 14 * .5:
                img.putpixel((xx, yy), C('#ffe7a0'))
    iron, rim = C('#3a1a30'), C(P['near_rim'])
    d.rectangle((x - 3, g - 6, x + 3, g - 1), fill=iron); d.line((x + 3, g - 6, x + 3, g - 1), fill=rim)
    d.rectangle((x - 2, g - 9, x + 2, g - 6), fill=iron)
    d.rectangle((x - 1, g - 72, x, g - 9), fill=iron); d.line((x + 1, g - 72, x + 1, g - 9), fill=rim)
    d.rectangle((x - 2, g - 40, x + 2, g - 38), fill=iron)
    d.rectangle((x - 2, g - 74, x + 2, g - 72), fill=iron)
    d.polygon([(x - 5, ly), (x + 5, ly), (x + 3, ly + 11), (x - 3, ly + 11)], fill=iron)
    d.polygon([(x - 4, ly + 1), (x + 4, ly + 1), (x + 2, ly + 10), (x - 2, ly + 10)], fill=C('#ffe7a0'))
    d.line((x, ly + 1, x, ly + 10), fill=C('#ffc878')); d.point((x - 3, ly + 2), fill=C('#ffffff'))
    d.polygon([(x - 6, ly), (x, ly - 5), (x + 6, ly)], fill=iron); d.line((x, ly - 5, x + 6, ly), fill=rim)
    d.line((x, ly - 7, x, ly - 6), fill=iron)
    return img

def build():
    return {'prop_streetlamp': streetlamp()}
