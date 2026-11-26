"""Квартира Саши в воскресенье: та же комната, что в «Среде», но днём — лампа и гирлянда не горят, свет серый,
из окон. Сбой тихий, без кислотного: комната растянута втрое и тает в ровный индиго — пустота, а не ужас."""
import numpy as np
from PIL import Image
from week_tone import duotone, rgb, to_palette
from week_office import W, H, BASE, PAD
from week_flat import Flat, _finish, _window, _sofa, _frames, _shelf, _plant, _doorway, _kitchen, _shell, WIN_A

VOID_RAMP = ('#17143a', '#211d50', '#302b6e', '#454096', '#625cb4', '#928cd4')
VOID_TOP, VOID_LOW = '#191638', '#221f4c'
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16


def _lamp_off(s, o):
    x = 124 + o
    s.ell((x - 9, 198, x + 9, 203), '#3a2a2a'); s.rect((x - 1, 116, x, 200), '#3a2a2a')
    s.poly([(x - 8, 102), (x + 7, 102), (x + 11, 117), (x - 12, 117)], '#cbb89a')


def quiet():
    s = Flat(False)
    for o in (PAD - W, PAD, PAD + W):
        _shell(s, o)
    for o in (PAD - W, PAD, PAD + W):
        _window(s, o, WIN_A, True); _lamp_off(s, o); _sofa(s, o); _frames(s, o); _shelf(s, o)
        _plant(s, 306 + o); _doorway(s, o); _kitchen(s, o)
        s.rect((4 + o, 112, 12 + o, 128), '#efe0c6'); s.rect((5 + o, 113, 11 + o, 115), '#c96a4a')  # календарь
        s.rect((214 + o, 197, 219 + o, 203), '#efe0c6'); s.rect((220 + o, 199, 221 + o, 201), '#efe0c6')  # кружка на полу у дивана
    s.light += 0.14                                              # день: ровный рассеянный свет вместо ламп
    s.lit((0, BASE - 5, s.w, BASE + 5), -0.12, 3, 'rect')
    s.grade(0, 92, -0.1, 0.0); s.grade(BASE, H, 0.0, 0.05)
    cool = np.asarray(s.cool, np.float32)[..., None] / 255
    a = np.asarray(s.img, np.float32); grey = a.mean(2, keepdims=True)
    s.img.paste(Image.fromarray(np.clip(a * 0.72 + grey * 0.28, 0, 255).astype(np.uint8)))   # воскресная блёклость
    s.light += cool[..., 0] * 0.16
    return s.render(shadow='#56608e', sun='#f2efe6', colors=54).crop((PAD, 0, PAD + W, H))


def void(room):
    """Пустота: кусок комнаты (окно, лампа, край дивана) растянут на всю плитку и тает к краям в ровный индиго."""
    x0, x1 = 16, 216
    wide = room.crop((x0, 0, x1, H)).resize((W, H), Image.NEAREST)
    a = np.asarray(wide, np.float32); hole = a[..., 3] == 0
    tone = duotone(VOID_RAMP)(np.clip(a[..., :3] * 1.12, 0, 255))
    xs, ys = np.meshgrid(np.arange(W), np.arange(H))
    t = np.clip((ys - 86) / (H - 86), 0, 1)[..., None]
    flat = np.array(rgb(VOID_TOP), np.float32) * (1 - t) + np.array(rgb(VOID_LOW), np.float32) * t
    keep = np.clip(1.4 - np.abs(xs - W / 2) / (W * 0.32), 0, 1) ** 1.5       # комната видна в середине плитки
    keep *= np.clip((ys - 70) / 60, 0.25, 1)                                 # потолок и верх стен тают первыми
    on = keep > np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
    out = np.where(on[..., None], tone, flat)
    for y, step in ((BASE, 1), (BASE + 18, 3), (BASE + 44, 7)):               # пол: линии досок редеют и уходят
        row = (xs[0] // 4) % step == 0
        out[y, row] = np.maximum(out[y, row], np.array(rgb('#353074'), np.float32))
    img = to_palette(out, 28, 4)
    alpha = np.where(hole & on, 0, 255).astype(np.uint8)
    img.putalpha(Image.fromarray(alpha))
    return img
