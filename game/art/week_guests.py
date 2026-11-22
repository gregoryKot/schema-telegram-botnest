"""Люди и вещи «Пятницы»: Женя с тортом (цель главы, 34x62), гости с лицом и в маске (40x60),
гость с просьбой, горы посуды вместо стопок дел (кадры как у wk_piles) и стена масок (40x132).
Маска — белое лицо с тёмной глазницей: причёска и одежда на месте, человека за ней не видно."""
from PIL import Image, ImageOps
from px import Canvas, C, strip
from week_rig import figure, mats, BLANK, PROP, PROP2
from week_cast import HEAD_SHORT, HEAD_BOB, HEAD_BUN, KEY, STAND, TALK, MUG, CARRY
from week_props import MATS as PROPS, PAPER, FOLD_A, FOLD_B, FOLD_C, PINK, DARK, PILE_H, PILE_FW, PILE_FH

KEY_MASK = dict(KEY, s=BLANK)
INK, DENIM, SAND = ('#1c1a30', '#2b2a44', '#3f3e5e'), ('#262a4a', '#3a4270', '#566098'), ('#8a7a72', '#c9b8a8', '#efe2d0')
GUESTS = {
    'a': dict(head=HEAD_BUN, top=('#a8382f', '#e45a48', '#ff9a80'), legs=INK, hair=('#231a36', '#3b3357', '#5a5078')),
    'b': dict(head=HEAD_SHORT, top=('#1f6a4c', '#2f9a6c', '#7ad6a4'), legs=SAND, hair=('#4a2c2a', '#74463a', '#9a6a52'),
              skin=('#8a5440', '#b97a5c', '#d9a07e')),
    'c': dict(head=HEAD_BOB, top=('#2f4a9a', '#4a74d6', '#92b0f6'), legs=INK, hair=('#a8783a', '#dcae5c', '#f6dc98')),
    'ask': dict(head=HEAD_SHORT, top=('#6a3a8a', '#9a5cc0', '#c99cea'), legs=DENIM, hair=('#231a36', '#3b3357', '#5a5078'),
                skin=('#c08a70', '#eab594', '#fbd9bc')),
    'friend': dict(head=HEAD_BOB, top=('#b8a48c', '#f4e8d4', '#ffffff'), legs=('#1f5a62', '#2f8088', '#62b4b6'),
                   hair=('#a03c1c', '#e06c2c', '#ffa860')),
}
CREAM = ('#e6c2a8', '#fff2e2', '#ffffff')


def look(head, top, legs, hair, skin=None, mask=False, prop=None):
    m = mats(top, legs, hair, **({'skin': skin} if skin else {}), **({'prop': prop} if prop else {}))
    return dict(head=head, key=KEY_MASK if mask else KEY, mats=m)


def friend(mask=False):
    """Женя несёт торт навстречу Саше: кадр 34x62, лицом влево. Свечи и глазурь — поверх рендера."""
    img = figure(CARRY, look(**GUESTS['friend'], mask=mask, prop=CREAM))
    px = img.load()
    cake = [(x, y) for y in range(img.height) for x in range(img.width) if px[x, y][:3] in [C(c)[:3] for c in CREAM] and x > 24]
    x0, x1, y0 = min(x for x, _ in cake), max(x for x, _ in cake), min(y for _, y in cake)
    for x in range(x0, x1 + 1):                                 # розовая глазурь с подтёками
        px[x, y0] = px[x, y0 + 1] = C('#f08a9a')
        if (x - x0) % 3 == 1:
            px[x, y0 + 2] = C('#f08a9a')
    for x in range(x0 + 1, x1, 3):                              # свечи: огонёк над контуром
        px[x, y0 - 2] = C('#ffd66b'); px[x, y0 - 3] = C('#fff6c8') if not mask else C('#ff3ea5')
    out = Image.new('RGBA', (34, 62), (0, 0, 0, 0))
    out.alpha_composite(img.crop((6, 0, 40, 60)), (0, 2))
    return ImageOps.mirror(out)


def dishes(h):
    """Гора посуды высотой h: тарелки стопкой, между ними миски; сверху кружка."""
    c = Canvas(PILE_FW, PILE_FH); y = PILE_FH - 1; i = h * 7
    top = PILE_FH - h
    while y > top + 4:
        i = (i * 1103515245 + 12345) & 0x7fffffff
        dx = (i >> 9) % 3 - 1
        if (i >> 5) % 4 == 0 and y - top > 9:                   # миска: трапеция в цвет
            mat = (FOLD_A, FOLD_B, FOLD_C)[(i >> 12) % 3]
            c.poly([(5 + dx, y - 4), (20 + dx, y - 4), (17 + dx, y), (8 + dx, y)], mat); y -= 5
        else:                                                   # тарелка: широкий край, узкое донце
            c.rect((3 + dx, y - 1, 22 + dx, y - 1), PAPER); c.rect((7 + dx, y, 18 + dx, y), PAPER)
            c.iline([(4 + dx, y - 1), (21 + dx, y - 1)], '#c9d2ea'); y -= 2
    c.rect((8, top, 15, y), FOLD_B if h % 2 else FOLD_C)        # кружка наверху, ручка вправо
    c.iline([(17, top + 1), (18, top + 2), (17, top + 3)], '#231a36')
    return c.render(PROPS)


def mask_wall():
    """Стена масок поперёк комнаты: одинаковые улыбки до потолка, между ними — волны смеха."""
    c = Canvas(40, 132)
    for k, y in enumerate(range(3, 126, 26)):
        x = (6, 11, 3, 9, 5)[k]
        c.ell((x, y, x + 22, y + 21), PAPER)
        c.iline([(x + 5, y + 8), (x + 8, y + 7)], '#231a36', 2); c.iline([(x + 14, y + 7), (x + 17, y + 8)], '#231a36', 2)
        c.iline([(x + 6, y + 13), (x + 8, y + 16), (x + 14, y + 16), (x + 16, y + 13)], '#ff3ea5', 2)   # одинаковая улыбка
        side = x + 26 if k % 2 == 0 else x - 5
        for j in range(3):                                      # «ха-ха»: дуги сбоку
            c.rect((side + (j if k % 2 == 0 else -j) * 2, y + 6 + j, side + (j if k % 2 == 0 else -j) * 2, y + 15 - j), PINK)
    return c.render(PROPS)


def cast():
    g = {}
    for k in 'abc':
        pose = (MUG, TALK, STAND)['abc'.index(k)]
        g['guest_' + k] = [figure(pose, look(**GUESTS[k])), figure(pose, look(**GUESTS[k], mask=True))]
    g['guest_ask'] = [figure(TALK, look(**GUESTS['ask'])), figure(TALK, look(**GUESTS['ask'], mask=True)), figure(MUG, look(**GUESTS['ask']))]
    g['friend_cake'] = [friend(), friend(True)]
    return g


def sprites():
    g = cast()
    return {**{'wk_' + k: strip(v) for k, v in g.items()}, 'wk_dishes': strip([dishes(h) for h in PILE_H]), 'wk_mask_wall': mask_wall()}
