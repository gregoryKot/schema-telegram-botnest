"""Люди «Недели»: Саша (стоит, бежит, пауза), коллеги с лицом и без, начальница-силуэт.
Палитра приглушённая: серое худи, охра рюкзака — единственное тёплое пятно героя."""
import math
from PIL import Image, ImageDraw
from px import C
from week_rig import figure, mats, HOOD, HAIR, SKIN, EYE, LID, BLANK

HEAD_SASHA = [
    "....HHHHHH....",
    "..HHHHHHHHHH..",
    ".HHHHHHHHHHHH.",
    ".HHHHHHHHHHHH.",
    "HHHHHHhhhhhhH.",
    "HHHHHhhhhsssH.",
    "HHHHHhhssssss.",
    "HHHHHhsssesss.",
    "HHHHHssssesss.",
    "HHHHHssssssss.",
    "HHHHHHsssssss.",
    ".HHHHHHsssss..",
    ".HHHHHHHsss...",
    "..HHHHHHH.....",
]
HEAD_SHORT = [
    "...hhhhhh...",
    ".hhhhhhhhh..",
    "hhhhhhhhhhh.",
    "hhhhhhhhhhh.",
    "hhhhhhssss..",
    "hhhhsssssss.",
    "hhhssssesss.",
    "hhhssssesss.",
    ".hhssssssss.",
    ".hsssssssss.",
    "..ssssssss..",
    "...ssssss...",
    "....sss.....",
]
HEAD_BOB = [
    "...hhhhhh...",
    ".hhhhhhhhh..",
    "hhhhhhhhhhh.",
    "hhhhhhhhhhh.",
    "hhhhhhhsss..",
    "hhhhhhsssss.",
    "hhhhhssesss.",
    "hhhhhssesss.",
    "hhhhhssssss.",
    "hhhhhssssss.",
    "hhhhhsssss..",
    ".hhhh.sss...",
    "......sss...",
]
KEY = {'H': HOOD, 'h': HAIR, 's': SKIN, 'e': EYE}
KEY_SHUT = dict(KEY, e=LID)
KEY_BLANK = dict(KEY, s=BLANK, e=BLANK)                      # сбой: лицо стёрто, причёска на месте

GREY = ('#6a6870', '#8e8e94', '#b6b6ba')
SASHA = dict(head=HEAD_SASHA, key=KEY, pack=True, phones=True, width=7,
             mats=mats(GREY, ('#5a5860', '#77767c', '#8e8e94'), ('#353846', '#4a4e60', '#666b7e'),
                       ('#2b2e3a', '#3a3e4e', '#4a4e60'), ('#2b2730', '#3e3a40', '#5a555c'),
                       pack=('#8a6a34', '#b8924a', '#d8b872')))

def colleague(head, top, legs, hair, skin=('#a87f6c', '#c9a28c', '#dcb8a0'), blank=False):
    far = lambda r: (r[0], r[0], r[1])
    return dict(head=head, key=KEY_BLANK if blank else KEY, mats=mats(top, far(top), legs, far(legs), hair, skin))

BLUE, CLAY = ('#5f6c7c', '#8090a2', '#a4b2c0'), ('#8a6658', '#ac8676', '#c8a696')
SLATE, SAND = ('#3e3c3a', '#565452', '#6e6a66'), ('#8c8272', '#aaa08e', '#c4bcaa')
KOLLEGA_A = dict(head=HEAD_SHORT, top=BLUE, legs=SLATE, hair=('#3e3028', '#5a463a', '#77604e'))
KOLLEGA_B = dict(head=HEAD_BOB, top=CLAY, legs=SAND, hair=('#5a4a3c', '#806a54', '#a08a70'),
                 skin=('#8a6450', '#a87e66', '#c09a80'))

STAND = dict(hip=(21, 27), legs=((4, 2), (-4, -2)), arms=((6, 14), (-6, 8)))
# пауза: стопы вместе, ладонь на груди, голова чуть вниз, глаза закрыты
PAUSE = dict(hip=(21, 27), legs=((2, 0), (-2, 0)), arms=((4, 10), (18, 150)), head=(0, 1))
TALK = dict(hip=(21, 27), legs=((3, 0), (-5, -2)), arms=((10, 60), (-4, 30)))

def run(i, n=6):
    """Кадр бега i из n: ноги и руки в противофазе, корпус наклонён, в середине шага — полёт."""
    def leg(ph):
        th = 42 * math.cos(ph)
        flex = 12 + 62 * max(0.0, math.sin(ph + 0.5)) ** 1.3  # колено гнётся на заднем махе
        return th, th - flex
    def arm(ph):
        up = -38 * math.cos(ph)
        return up, up + 78
    ph = 2 * math.pi * i / n
    foot = lambda p: -28 * math.sin(p + 0.5) if math.sin(p + 0.5) > 0 else 12 * math.cos(p)
    lift = (1, 0, 2, 1, 0, 2)[i % 6]
    return dict(hip=(20, 25 + lift), lean=12, legs=(leg(ph + math.pi), leg(ph)), arms=(arm(ph + math.pi), arm(ph)),
                feet=(foot(ph + math.pi), foot(ph)), head=(1, 0))

def sasha(pose, shut=False):
    return figure(pose, dict(SASHA, key=KEY_SHUT) if shut else SASHA)

def sasha_run():
    return [sasha(run(i)) for i in range(6)]

def boss(h=78, mug=True, col='#3e3c3a'):
    """Начальница — плоский силуэт: каре, плечи пиджака, кружка в согнутой руке. h — рост в px."""
    k = h / 60
    w = round(34 * k) + 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    P = lambda pts: [(x * k + 1, y * k) for x, y in pts]
    d.polygon(P([(11, 0), (18, 0), (21, 3), (22, 12), (20, 13), (9, 13), (7, 12), (8, 3)]), fill=C(col))       # каре
    d.polygon(P([(12, 12), (17, 12), (17, 16), (24, 18), (27, 24), (26, 42), (25, 60), (4, 60), (3, 42), (2, 24), (5, 18), (12, 16)]),
              fill=C(col))                                                                                    # пиджак
    if mug:
        d.line(P([(25, 21), (31, 31), (25, 35)]), fill=C(col), width=max(3, round(4 * k)))                    # рука
        mx, my, ms = round(19 * k), round(30 * k), max(4, round(6 * k))
        d.rectangle([mx, my, mx + ms, my + ms], fill=C('#d8d2c4'))
        d.rectangle([mx - 2, my + 1, mx - 1, my + ms - 2], outline=C('#d8d2c4'))
        d.rectangle([mx, my + ms - 1, mx + ms, my + ms], fill=C('#a8a49c'))
        for i in range(max(2, round(3 * k))):                                                                 # пар
            d.point((mx + 1 + (i % 2) * 2, my - 2 - i * 2), fill=C('#a8a49c'))
    return img

def cast():
    """Все фигуры эталона по именам."""
    a, b = colleague(**KOLLEGA_A), colleague(**KOLLEGA_B)
    return {
        'sasha_stand': sasha(STAND), 'sasha_pause': sasha(PAUSE, shut=True), 'sasha_run': sasha_run(),
        'kollega_a': figure(STAND, a), 'kollega_b': figure(TALK, b),
        'kollega_a_blank': figure(STAND, colleague(**KOLLEGA_A, blank=True)),
        'kollega_b_blank': figure(TALK, colleague(**KOLLEGA_B, blank=True)),
        'boss': boss(),
    }
