// Сцены приложения, общие для нескольких партий редизайна (docs/design/PAPER_2026-11.md,
// «Сцены»): тот же каркас, что у лендинга (sceneKit: лист-подложка по --h, тень сплошным
// сдвинутым слоем Lift, холст 320×260 с равными полями), те же элементы языка.
//  • Sprout — «готово»: знак сущности стоит на земле, рядом проросший лист. Знак не
//    перерисован: тот же мотив по ключу (SignArt) вложенным svg (SignInScene).
//  • SceneBreath — дыхание: две дуги Breath над полоской; дуги расходятся на вдохе, стоят на
//    задержке, опускаются на выдохе; `rest` — дыхание улеглось, у основания полоски вырос лист.
//    Движение — только transform с переходом (paper-scenes.css), reduced-motion его снимает.
//  • ScenePebbleLaid — дневник: на белом листе камешки, последний только лёг (тень выше);
//    `filled` — сколько легло, остальные ждут на земле пустым тоном (пустая лента — один на
//    листе, два ждут; `filled = 0` — пустой лист без выдуманных записей).
// Сцены одной партии рисуются в её файлах; сюда — только то, что нужно двум и более.
import type { CSSProperties } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { ArtFrameContext, type ArtFrame } from './paper';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SignArt } from './SignArt';

/** Знак кабинета внутри сцены: тот же мотив по ключу, вложенным svg в рамке холста. */
export function SignInScene({ sign, ...frame }: { sign: SignKey } & ArtFrame) {
  return (
    <ArtFrameContext.Provider value={frame}>
      <SignArt sign={sign} />
    </ArtFrameContext.Provider>
  );
}

/** Проросший лист у земли (y = 204): стебель, лист и листок поменьше. */
function SproutLeaf() {
  return (
    <>
      <path d="M250 202 C250 182 254 166 262 152" fill="none" stroke={INK.moss} strokeWidth="6" strokeLinecap="round" />
      <path d="M262 152 C256 126 272 108 288 106 C290 132 278 152 262 152 Z" fill={INK.moss} />
      <path d="M250 186 C258 174 270 174 278 180 C270 194 258 196 250 186 Z" fill={INK.sage} />
    </>
  );
}

/** «Готово»: знак сущности на земле и проросший лист — сделанное прорастает. Рамка знака
 *  ставит его линию земли (у знаков с землёй — y 60 из 64) на землю сцены. */
export function Sprout({ sign, hue = 135, patch }: { sign: SignKey; hue?: number; patch?: number }) {
  return (
    <SceneSvg hue={hue} patch={patch} patchAt="bl" sheet="c">
      <Lift>
        <path d="M30 204 H286" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <SignInScene sign={sign} x={18} y={90} w={228} h={122} />
        <SproutLeaf />
      </Lift>
    </SceneSvg>
  );
}

export type BreathScenePhase = 'in' | 'hold' | 'out' | 'rest';

/** Положение дуг по фазе; центр масштаба — середина земли под дугами (160 206, paper-scenes.css). */
const ARCS: Record<BreathScenePhase, string> = {
  in: 'scale(1.08)',
  hold: 'scale(1.08)',
  out: 'scale(1)',
  rest: 'scale(0.94, 0.86)',
};

/** Дыхание: полоска стоит под двумя дугами Breath, дуги дышат. `phase` — вдох, задержка,
 *  выдох, улеглось (дуги осели, у полоски вырос лист); `seconds` — длина перехода (длина фазы). */
export function SceneBreath({ phase = 'in', hue = 45, seconds }: { phase?: BreathScenePhase; hue?: number; seconds?: number }) {
  const arcs = { transform: ARCS[phase], transitionDuration: seconds ? `${seconds}s` : undefined } as CSSProperties;
  const arc = { fill: 'none', strokeWidth: 22, strokeLinecap: 'butt' } as const;
  return (
    <SceneSvg hue={hue} patch={135} patchAt="tr" sheet="a" className={`scn-breath scn-breath--${phase}`}>
      <Lift>
        <path d="M30 210 H290" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <rect x="146" y="166" width="28" height="42" rx="14" fill={INK.clay} />
        {phase === 'rest' && <path d="M178 206 C176 190 184 180 198 176 C200 190 194 202 178 206 Z" fill={INK.moss} />}
      </Lift>
      <g className="scn-breath-arcs" style={arcs}>
        <Lift>
          <path d="M56 206 A104 104 0 0 1 264 206" stroke={INK.sage} {...arc} />
          <path d="M92 206 A68 68 0 0 1 228 206" stroke={INK.moss} {...arc} />
        </Lift>
      </g>
    </SceneSvg>
  );
}

/** Камешки: место на листе (лёг) и место на земле справа от листа (ждёт) — у каждого своё. */
const PEBBLES = [
  { on: { cx: 100, cy: 176, rx: 22, ry: 14 }, wait: { cx: 236, cy: 212, rx: 18, ry: 11 }, fill: INK.moss },
  { on: { cx: 142, cy: 164, rx: 19, ry: 12 }, wait: { cx: 264, cy: 200, rx: 15, ry: 9.5 }, fill: INK.amber },
  { on: { cx: 176, cy: 148, rx: 16, ry: 10 }, wait: { cx: 272, cy: 222, rx: 13, ry: 8 }, fill: INK.clay },
] as const;

type Spot = { cx: number; cy: number; rx: number; ry: number };
const pebble = (s: Spot, fill: string, laid: boolean) => (
  <ellipse key={s.cx} data-laid={laid ? 'yes' : 'no'} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={`rotate(-16 ${s.cx} ${s.cy})`} fill={fill} />
);

/** Камешек лёг: на белом листе `filled` камешков (до трёх), последний лёг только что (тень выше);
 *  остальные ждут на земле пустым тоном и без тени. `filled = 0` — пустой лист, все ждут. */
export function ScenePebbleLaid({ hue = 45, filled = 3 }: { hue?: number; filled?: number }) {
  const n = Math.max(0, Math.min(PEBBLES.length, Math.floor(filled)));
  const laid = PEBBLES.slice(0, n);
  return (
    <SceneSvg hue={hue} patch={135} patchAt="bl" sheet="b">
      {PEBBLES.slice(n).map((p) => pebble(p.wait, INK.hollow, false))}
      <g transform="rotate(-4 160 128)">
        <Lift><rect x="60" y="34" width="150" height="188" rx="14" fill={INK.sheet} /></Lift>
        <Lift by={3}>{laid.slice(0, -1).map((p) => pebble(p.on, p.fill, true))}</Lift>
        {n > 0 && <Lift by={8}>{pebble(laid[n - 1].on, laid[n - 1].fill, true)}</Lift>}
      </g>
    </SceneSvg>
  );
}
