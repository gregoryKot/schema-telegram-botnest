"""Листы Мистера: покой, бег, удар, сдача, клубок. Кадр 36x36, кот смотрит вправо.
Ключевые позы бега — из эталона (ref/cat2.py); промежуточные кадры — середина между ключами."""
from cat import frame, GY, HEAD_BLINK, HEAD_DASH, HEAD_HALF, HEAD_SLEEP, HEAD_BACK, HEAD_BACK_SHUT
from px import strip

def _mid(a, b):
    """Середина двух поз с одинаковым числом точек."""
    m = lambda u, v: [tuple(round((p + q) / 2) for p, q in zip(s, t)) for s, t in zip(u, v)]
    return dict(body=tuple(round((p + q) / 2) for p, q in zip(a['body'], b['body'])),
                head=tuple(round((p + q) / 2) for p, q in zip(a['head'], b['head'])),
                tail=m(a['tail'], b['tail']),
                far=[m(u, v) for u, v in zip(a['far'], b['far'])],
                near=[m(u, v) for u, v in zip(a['near'], b['near'])])

IDLE = dict(body=(8, 20, 26, 30), head=(19, 8),
            tail=[(9, 24), (6, 22), (4, 18), (4, 14), (6, 11), (8, 10)],
            far=[[(13, 28), (13, GY)], [(21, 28), (21, GY)]],
            near=[[(10, 28), (10, GY)], [(24, 28), (24, GY)]])
TAILS = (IDLE['tail'],                                                  # кончик хвоста покачивается
         [(9, 24), (6, 22), (4, 18), (4, 14), (5, 11), (7, 9)],
         [(9, 24), (6, 22), (4, 18), (3, 14), (4, 11), (5, 9)])

def idle():
    """12 кадров: хвост туда-обратно, одно моргание."""
    sway = (0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0)
    return [dict(IDLE, tail=TAILS[t], **({'face': HEAD_BLINK} if i == 9 else {})) for i, t in enumerate(sway)]

PUSH = dict(body=(5, 19, 25, 28), head=(19, 9),       # толчок: лапы врозь
            tail=[(6, 22), (3, 19), (2, 16), (2, 12), (3, 10)],
            far=[[(10, 26), (6, 31), (3, 33)], [(21, 26), (25, 31), (28, 33)]],
            near=[[(8, 26), (5, 30), (2, 34)], [(23, 26), (28, 30), (30, 33)]])
FLY = dict(body=(5, 18, 25, 27), head=(19, 7),        # полёт: тело вытянуто, над землёй
           tail=[(6, 21), (3, 18), (2, 15), (2, 13), (3, 12)],
           far=[[(10, 25), (5, 28), (2, 28)], [(21, 25), (27, 27), (30, 26)]],
           near=[[(8, 25), (4, 29), (2, 30)], [(23, 25), (29, 28), (32, 27)]])
GATHER = dict(body=(8, 18, 25, 29), head=(19, 8),     # проход: лапы под телом, спина горбом
              tail=[(9, 21), (5, 18), (3, 14), (3, 12), (4, 10)],
              far=[[(15, 27), (17, 30), (18, 33)], [(21, 27), (19, 30), (18, 32)]],
              near=[[(11, 27), (12, 31), (12, GY)], [(24, 27), (23, 31), (23, GY)]])
DASH = dict(body=(3, 20, 27, 28), head=(19, 11), face=HEAD_DASH, tail=[(4, 23), (1, 22)], tail_w=2,
            far=[[(8, 26), (3, 29), (1, 29)], [(23, 26), (30, 29), (32, 29)]],
            near=[[(7, 26), (2, 28)], [(24, 26), (31, 28), (33, 28)]],
            streaks=((17, 3, 12), (31, 0, 9), (25, 0, 2)))

def run():
    """6 кадров галопа (кадр 2 — полёт, он же прыжок) + кадр 6 — рывок."""
    return [PUSH, _mid(PUSH, FLY), FLY, _mid(FLY, GATHER), GATHER, _mid(GATHER, PUSH), DASH]

def lunge():
    """FIGHT: присел назад, удар лапой вперёд, отдача — удар выматывает, а не радует."""
    back = [[(10, 29), (8, 32), (10, GY)], [(7, 29), (5, 32), (7, GY)]]
    crouch = dict(body=(3, 23, 22, 32), head=(13, 13), face=HEAD_DASH,
                  tail=[(4, 27), (2, 28), (1, 30), (1, 32)],
                  far=[back[0], [(18, 30), (19, 33), (18, GY)]], near=[back[1], [(20, 30), (22, 33), (21, GY)]])
    strike = dict(body=(3, 20, 24, 29), head=(17, 9), face=HEAD_DASH,
                  tail=[(4, 23), (2, 21), (1, 19), (1, 17)],
                  far=[back[0], [(19, 27), (20, 31), (19, GY)]],
                  near=[back[1], [(22, 26), (29, 25), (34, 24)]], streaks=((27, 31, 36), (21, 34, 36)))
    slash = dict(strike, near=[back[1], [(22, 26), (29, 28), (33, 31)]], streaks=((24, 32, 36), (28, 35, 36)))
    land = dict(body=(5, 20, 25, 30), head=(18, 9), tail=[(6, 24), (4, 24), (2, 26), (1, 28)],
                far=[back[0], [(20, 28), (20, GY)]], near=[back[1], [(23, 28), (24, 32), (24, GY)]])
    tired = dict(IDLE, head=(19, 10), face=HEAD_HALF, tail=[(9, 25), (6, 27), (4, 30), (3, 33)])
    return [dict(crouch, head=(14, 12)), crouch, strike, slash, land, tired]

def appease():
    """FAWN: на спине, брюхом вверх, лапы в воздухе — сдаётся."""
    f = []
    for w, face in ((0, HEAD_HALF), (1, HEAD_HALF), (0, HEAD_BLINK), (1, HEAD_BLINK), (0, HEAD_HALF), (1, HEAD_HALF)):
        hind, fore = [(9, 28), (7, 23), (5 + w, 19)], [(15, 28), (16, 23), (18 - w, 19 + w)]
        f.append(dict(body=(4, 26, 26, 35), head=(20, 21 + w), face=face, belly=(8, 27, 19, 30), seam=True,
                      tail=[(6, 32), (3, 33), (1, 31 - 2 * w)], tail_w=2,
                      far=[[(12, 28), (11, 24), (10 + w, 21)]], near=[hind, fore], pads=[hind[-1], fore[-1]]))
    return f

def freeze():
    """FREEZE: приседает и сворачивается клубком, хвост вокруг, медленное дыхание."""
    low = dict(body=(8, 22, 26, 32), head=(19, 11), face=HEAD_HALF,
               tail=[(9, 26), (6, 26), (4, 28), (3, 31)],
               far=[[(13, 30), (13, GY)], [(21, 30), (21, GY)]], near=[[(10, 30), (10, GY)], [(24, 30), (24, GY)]])
    lower = dict(body=(5, 23, 27, 35), head=(19, 16), face=HEAD_BLINK, paws=False, seam=True,
                 tail=[(7, 30), (4, 31), (2, 33)], far=[], near=[[(22, 33), (27, 34)]])
    ball = lambda top: dict(body=(3, top, 28, 35), head=(18, 20), face=HEAD_BLINK, paws=False, seam=True,
                            far=[], near=[], wrap=[(5, 31), (9, 34), (22, 34), (28, 33), (31, 31)])
    return [low, lower, ball(19), ball(18), ball(19), ball(19)]

SHEETS = {'cat_idle': idle, 'cat_run': run, 'cat_dash': lunge, 'cat_play': appease, 'cat_sleep': freeze}

def build():
    return {k: strip([frame(p) for p in fn()]) for k, fn in SHEETS.items()}
