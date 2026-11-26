// Сцена «Безопасное место» (docs/design/PAPER_2026-11.md, «Сцены приложения»: SceneHaven, b18) — знак Haven
// крупно на шалфее (ENTITY_LOOK.safe_place): рамка мха с открытым верхом — граница, а не стена. Место
// собирается из того, что человек описал сам: назвал место — в рамке на земле круг глины (своя часть);
// каждое заполненное чувство добавляет свой элемент — вижу: лист растёт, слышу: дуга воздуха над
// открытым верхом, чувствую телом: тёплая полоска-плед на земле под кругом, обоняю: камешки у рамки.
// Пусто — пустая рамка на земле, без выдуманных фигур. Те же элементы строчным размером — у полей
// формы и строк итога (HavenSenseMark): видно, какое поле что «включает».
// Каркас — sceneKit (лист-подложка, квадратик соломы, тень сплошным слоем Lift). Декор: смысл несёт текст.
import type { ReactNode } from 'react';
import { PAPER } from './paper';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SENSES } from '../exercises/safePlaceText';

/** Чувство — ключ поля формы (SENSES, exercises/safePlaceText.ts): одна таблица полей на форму и сцену. */
type HavenSense = (typeof SENSES)[number]['k'];

/** Элемент чувства: фигуры в единицах холста 320×260 и окно для строчной метки. */
const SENSE_ART: Record<HavenSense, { box: string; art: (fill: (c: string) => string) => ReactNode }> = {
  see: {
    box: '160 124 64 80',
    art: (c) => <path d="M176 200 C166 170 182 140 214 130 C218 166 204 192 176 200 Z" fill={c(INK.moss)} />,
  },
  hear: {
    box: '84 2 136 60',
    art: (c) => <path d="M94 52 Q152 4 210 52" fill="none" stroke={c(INK.teal)} strokeWidth="11" strokeLinecap="round" />,
  },
  feel: {
    box: '92 176 120 32',
    art: (c) => <rect x="98" y="191" width="108" height="10" rx="5" fill={c(INK.amber)} />,
  },
  smell: {
    box: '236 186 58 30',
    art: (c) => (
      <>
        <ellipse cx="252" cy="206" rx="13" ry="7.5" fill={c(INK.slate)} />
        <ellipse cx="275" cy="208" rx="10" ry="5.5" fill={c(INK.amber)} />
        <ellipse cx="264" cy="195" rx="8" ry="4.5" fill={c(INK.clay)} />
      </>
    ),
  },
};

const asIs = (c: string) => c;
const hollow = () => PAPER.hollow;

/** Безопасное место: `place` — место названо, `senses` — какие чувства описаны. */
export function SceneHaven({ place, senses, hue = 135 }: { place: boolean; senses: Partial<Record<HavenSense, boolean>>; hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={70} patchAt="tr" sheet="b" className="scn-haven">
      <Lift>
        <path d="M30 214 H290" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <path d="M78 64 V184 Q78 208 102 208 H202 Q226 208 226 184 V64" fill="none" stroke={INK.moss} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        {SENSES.map(({ k }) => senses[k] && <g key={k} data-sense={k}>{SENSE_ART[k].art(asIs)}</g>)}
        {place && <circle data-place="" cx="124" cy="176" r="22" fill={INK.clay} />}
      </Lift>
    </SceneSvg>
  );
}

/** Строчная метка чувства у поля и в итоге: элемент сцены — цветом, пока поле пусто — пустым тоном. */
export function HavenSenseMark({ sense, on }: { sense: HavenSense; on: boolean }) {
  const { box, art } = SENSE_ART[sense];
  return (
    <svg className="ex2-sense-mark" viewBox={box} aria-hidden="true" focusable="false" data-on={on || undefined}>
      {art(on ? asIs : hollow)}
    </svg>
  );
}
