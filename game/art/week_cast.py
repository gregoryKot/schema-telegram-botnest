"""Люди «Недели»: Саша (все позы хука), коллеги с лицом и без, начальница.
Саша — холодное серое худи и горчичный рюкзак: единственное тёплое пятно героя, видно на любом фоне."""
import math
from px import strip
from week_rig import figure, mats, HOOD, HAIR, SKIN, EYE, LID, BLANK, SKIN_A

HEAD_SASHA = [
    "...HHHHHH..",
    "..HHHHHHHH.",
    ".HHHHHHHHHH",
    ".HHHHHhhhhH",
    "HHHHHhssss.",
    "HHHHHssses.",
    "HHHHHssses.",
    "HHHHHsssss.",
    "HHHHHHssss.",
    ".HHHHHHss..",
    ".HHHHHH....",
    "..HHHH.....",
]
HEAD_SHORT = [
    "..hhhhhh..",
    ".hhhhhhhh.",
    "hhhhhhhhhh",
    "hhhhhsssh.",
    "hhhssssss.",
    "hhsssses..",
    "hhsssses..",
    ".hsssssss.",
    ".hssssss..",
    "..sssss...",
    "...sss....",
]
HEAD_BOB = [
    "..hhhhhh..",
    ".hhhhhhhh.",
    "hhhhhhhhhh",
    "hhhhhhsss.",
    "hhhhsssss.",
    "hhhhsses..",
    "hhhhsses..",
    "hhhhsssss.",
    "hhhhssss..",
    "hhhh.sss..",
    ".hh..sss..",
]
HEAD_BUN = [
    "hh.hhhhh..",
    "hhhhhhhhh.",
    "hhhhhhhhhh",
    ".hhhhhsss.",
    ".hhhsssss.",
    ".hhssses..",
    ".hhssses..",
    ".hhssssss.",
    "..hsssss..",
    "...ssss...",
    "...sss....",
]
KEY = {'H': HOOD, 'h': HAIR, 's': SKIN, 'e': EYE}
KEY_SHUT = dict(KEY, e=LID)
KEY_BLANK = dict(KEY, s=BLANK, e=BLANK)                      # сбой: лицо стёрто, причёска на месте

HOODIE, JEANS = ('#5b6382', '#9aa3b8', '#e4e8ef'), ('#262a4a', '#3a4270', '#566098')
MUSTARD, INK_HAIR = ('#b5651d', '#f0a830', '#ffd66b'), ('#231a36', '#3b3357', '#5a5078')

def sasha_look(load=0.0, shut=False):
    return dict(head=HEAD_SASHA, key=KEY_SHUT if shut else KEY, pack=load, phones=True, width=5,
                mats=mats(HOODIE, JEANS, INK_HAIR, pack=MUSTARD))

PEOPLE = {
    'a': dict(head=HEAD_SHORT, top=('#2f6f78', '#4b97a0', '#86c5c8'), legs=('#2b2a44', '#3f3e5e', '#5a5a80'),
              hair=('#3a2430', '#5c3a40', '#7e5650')),
    'b': dict(head=HEAD_BOB, top=('#9a4a3c', '#cf6f55', '#eda283'), legs=('#6f6a82', '#a39cae', '#cfc8d2'),
              hair=('#4a2c2a', '#74463a', '#9a6a52'), skin=('#8a5440', '#b97a5c', '#d9a07e')),
    'c': dict(head=HEAD_BUN, top=('#5a3a66', '#84568f', '#b58abd'), legs=('#2b2a44', '#3f3e5e', '#5a5a80'),
              hair=('#231a36', '#3b3357', '#5a5078'), skin=('#c08a70', '#eab594', '#fbd9bc')),
}
BOSS = dict(head=HEAD_BOB, top=('#1f2a4a', '#2f4070', '#4a62a0'), legs=('#1c1a30', '#2b2a44', '#3f3e5e'),
            hair=('#5a3320', '#8a5230', '#b87a48'))

def person(head, top, legs, hair, skin=SKIN_A, blank=False):
    return dict(head=head, key=KEY_BLANK if blank else KEY, mats=mats(top, legs, hair, skin))

STAND = dict(hip=(19, 20), legs=((4, 2), (-4, -2)), arms=((6, 14), (-6, 8)))
BREATH = dict(STAND, hip=(19, 20), head=(0, 1), arms=((7, 15), (-5, 9)))
TALK = dict(hip=(19, 20), legs=((3, 0), (-5, -2)), arms=((10, 60), (-4, 30)))
CARRY = dict(hip=(19, 20), legs=((3, 0), (-4, -2)), arms=((30, 80), (34, 84)), hold='box')
MUG = dict(hip=(19, 20), legs=((3, 1), (-3, -1)), arms=((8, 20), (20, 120)))
SIT_DESK = dict(hip=(15, 15), legs=((86, 2), (82, -2)), arms=((30, 84), (24, 86)))
# пауза: стопы вместе, ладонь на груди, голова чуть вниз, глаза закрыты
PAUSE = dict(hip=(19, 20), legs=((2, 0), (-2, 0)), arms=((4, 10), (18, 150)), head=(0, 1))
# без сил: сидит на полу, колени к груди, голова опущена
REST = dict(hip=(17, 5), lean=14, legs=((70, -60), (62, -66)), arms=((38, 70), (44, 62)), head=(1, 2), feet=(0, 0))
JUMP = dict(hip=(19, 23), lean=8, legs=((50, -40), (20, -50)), arms=((-60, 20), (70, 100)), feet=(-20, -30), head=(1, -1))
FALL = dict(hip=(19, 22), lean=4, legs=((24, 8), (-14, -4)), arms=((-110, -70), (100, 150)), feet=(-30, -20))
DASH = (dict(hip=(17, 17), lean=34, legs=((-50, -84), (58, 30)), arms=((-70, -30), (64, 96)), feet=(-60, 10), head=(2, 1)),
        dict(hip=(18, 17), lean=34, legs=((54, 26), (-52, -88)), arms=((58, 100), (-74, -36)), feet=(8, -60), head=(2, 1)))

def gait(i, n, swing, flex, arm, lean, bob, phone=False):
    """Кадр шага i из n: ноги и руки в противофазе; swing — размах бедра, flex — сгиб колена на заднем махе."""
    def leg(ph):
        th = swing * math.cos(ph)
        return th, th - (flex[0] + flex[1] * max(0.0, math.sin(ph + 0.5)) ** 1.3)
    def hand(ph):
        up = -arm * math.cos(ph)
        return up, up + (78 if arm > 20 else 14)
    ph = 2 * math.pi * i / n
    foot = lambda p: -28 * math.sin(p + 0.5) * swing / 42 if math.sin(p + 0.5) > 0 else 12 * math.cos(p) * swing / 42
    lift = bob * abs(math.sin(ph))
    near = (26, 118) if phone else hand(ph)
    return dict(hip=(19, 19 + lift), lean=lean, legs=(leg(ph + math.pi), leg(ph)), arms=(hand(ph + math.pi), near),
                feet=(foot(ph + math.pi), foot(ph)), head=(1, 2 if phone else 0), hold='phone' if phone else None)

walk = lambda i: gait(i, 6, 22, (4, 26), 16, 2, 1)
run = lambda i, phone=False: gait(i, 8, 42, (12, 62), 38, 12, 2.4, phone)
trudge = lambda i: dict(gait(i, 6, 12, (6, 14), 6, 16, 0.6), head=(2, 3))

def sasha():
    """Листы Саши: имя -> кадры. *_heavy — тот же ход с полным рюкзаком (цена «согласиться»)."""
    s = {}
    for tag, load in (('', 0.0), ('_heavy', 1.0)):
        f = lambda p, shut=False: figure(p, sasha_look(load, shut))
        s['idle' + tag] = [f(STAND), f(STAND), f(BREATH), f(BREATH)]
        s['walk' + tag] = [f(walk(i)) for i in range(6)]
        s['run' + tag] = [f(run(i)) for i in range(8)]
        s['phone' + tag] = [f(run(i, True)) for i in range(8)]
        s['air' + tag] = [f(JUMP), f(FALL)]
        s['dash' + tag] = [f(DASH[0]), f(DASH[1])]
        s['still' + tag] = [f(PAUSE, True), f(REST, True)] + [f(trudge(i)) for i in range(6)]
    return s

def cast():
    """Все фигуры хука: листы Саши по именам, коллеги (лицо, без лица), начальница."""
    c = {'sasha_' + k: v for k, v in sasha().items()}
    for k, p in PEOPLE.items():
        pose = (STAND, TALK, MUG)['abc'.index(k)]
        c['colleague_' + k] = [figure(pose, person(**p)), figure(pose, person(**p, blank=True))]
        c['sit_' + k] = figure(SIT_DESK, person(**p))
    c['colleague_box'] = [figure(CARRY, person(**PEOPLE['a'])), figure(CARRY, person(**PEOPLE['a'], blank=True)),
                          figure(TALK, person(**PEOPLE['a']))]
    c['boss'] = [figure(MUG, person(**BOSS)), figure(MUG, person(**BOSS, blank=True))]
    return c

if __name__ == '__main__':
    from px import up
    from PIL import Image
    c = cast()
    row = strip(c['sasha_idle'][:1] + c['sasha_walk'] + c['sasha_run'] + c['sasha_phone'][:3] + c['sasha_air'] + c['sasha_dash']
                + c['sasha_still'] + c['sasha_run_heavy'][:2])
    row2 = strip(c['colleague_a'] + c['colleague_b'] + c['colleague_c'] + c['colleague_box'] + c['boss'] + [c['sit_a'], c['sit_b']])
    s = Image.new('RGBA', (row.width, 124), (0x8f, 0xa6, 0xb2, 255))
    s.alpha_composite(row, (0, 0)); s.alpha_composite(row2, (0, 62))
    up(s, 3).crop((0, 0, 2400, 372)).save('/tmp/claude-0/-home-user-schema-telegram-botnest/3016c40d-007f-5ab0-b178-e3193d4358b5/scratchpad/cast1.png')
    up(s, 3).crop((2400, 0, 4800, 372)).save('/tmp/claude-0/-home-user-schema-telegram-botnest/3016c40d-007f-5ab0-b178-e3193d4358b5/scratchpad/cast2.png')
