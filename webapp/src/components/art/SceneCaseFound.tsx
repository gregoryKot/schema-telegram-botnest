// SceneCaseFound — итог разбора «Похоже на режим» (docs/design/PAPER_2026-11.md, «Сцены»; b09):
// на бумаге группы найденного режима лента разбора (мотив Ribbon крупно) делает петлю — момент
// зацепил — и тянется к знаку группы режима, который стоит на земле: часть, взявшая управление.
// Вместо цветной точки у имени режима. Знак не перерисован — тот же мотив по ключу (SignInScene),
// что у строки режима, листа подсказок терапевта и чипа. Каркас — sceneKit (лист-подложка по --h,
// тень сплошным сдвинутым слоем Lift, холст 320×260); квадратик шалфея — бумага «Что случилось».
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SignInScene } from './AppScenes';

/** Лента: петля слева над землёй, хвост тянется вправо и опускается к части — не заходя на знак
 *  (левый край знаков групп в рамке ниже — не левее x 145). */
const RIBBON = 'M24 140 C 26 94, 80 70, 104 98 C 124 122, 86 148, 70 122 C 56 98, 90 66, 124 80 C 142 88, 140 112, 128 132';

export function SceneCaseFound({ sign, hue, className }: { sign: SignKey; hue: number; className?: string }) {
  return (
    <SceneSvg hue={hue} patch={135} patchAt="bl" sheet="a" className={className}>
      <Lift>
        <path d="M34 206 H286" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <path data-ribbon="" d={RIBBON} fill="none" stroke={INK.clay} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
        <SignInScene sign={sign} x={128} y={122} w={168} h={90} />
      </Lift>
    </SceneSvg>
  );
}
