// Сцена «Критик или забота?» (docs/design/PAPER_2026-11.md, «Сцены приложения»: ScenePhrase, b18) — герой
// разбора фразы на сливе (ENTITY_LOOK.phrase_check): два голоса на одной земле. Слева Looming — круг
// критика навис, своя часть сплющилась о землю; справа Together — забота стоит рядом со своей частью,
// растёт лист. Фраза — это выбор между ними. Знаки не перерисованы: те же мотивы по ключу (SignInScene),
// их линии земли (y 61 и 58 из 64) поставлены на общую землю сцены. Каркас — sceneKit (лист-подложка,
// квадратик мха, тень сплошным слоем Lift). Декор: смысл несёт заголовок рядом.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SignInScene } from './AppScenes';

/** Ширина знака в сцене; высота — по холсту знака 120×64. Рамки знаков заходят друг на друга полями
 *  холста (рисунки — нет): фигуры крупнее, правый лист не выходит за край подложки. */
const W = 160;
const H = (W * 64) / 120;
/** Общая земля сцены (y): рамка каждого знака сдвинута так, что его земля ложится на неё. */
const GROUND = 206;

export function ScenePhrase({ hue = 310 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={145} patchAt="bl" sheet="a" className="scn-phrase">
      <Lift>
        <path d={`M30 ${GROUND} H290`} stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <SignInScene sign="looming" x={6} y={GROUND - (H * 61) / 64} w={W} h={H} />
        <SignInScene sign="together" x={136} y={GROUND - (H * 58) / 64} w={W} h={H} />
      </Lift>
    </SceneSvg>
  );
}
