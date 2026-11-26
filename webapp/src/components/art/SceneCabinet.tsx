// Сцена пустого кабинета терапевта (docs/design/PAPER_2026-11.md, «Сцены приложения»: SceneCabinet —
// пустые «Сегодня» и «Клиенты», b29): на листе неба (встречи терапевта, ENTITY_LOOK.therapist) веер
// трёх листов-карточек — записи о людях; на верхнем вместо фото круг глины и строки. Перед веером —
// знак Talk крупно (тот же мотив по ключу, SignInScene): разговоры с людьми. Вместо трёх чашек
// подряд у нового терапевта. Каркас — sceneKit (лист-подложка по --h, квадратик соломы, тень
// сплошным сдвинутым слоем Lift). Декор: смысл несёт текст рядом.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SignInScene } from './AppScenes';

/** Карточки веера снизу вверх: задние — солома и шалфей (не в тон небу), верхняя — белый лист. */
const FAN = [
  { deg: -14, fill: INK.amberSoft },
  { deg: -5, fill: INK.sage },
  { deg: 5, fill: INK.sheet },
] as const;
/** Центр поворота веера — нижний край карточек (как карты в руке). */
const PIVOT = '118 196';

export function SceneCabinet({ hue = 240 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={70} patchAt="tr" sheet="b" className="scn-cabinet">
      <Lift>
        <path d="M36 212 H284" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        {FAN.map((c, i) => (
          <g key={c.deg} data-card={i} transform={`rotate(${c.deg} ${PIVOT})`}>
            <rect x="58" y="56" width="120" height="142" rx="14" fill={c.fill} />
            {i === FAN.length - 1 && (
              <>
                <circle data-photo="" cx="96" cy="94" r="20" fill={INK.clay} />
                {[130, 148, 166].map((y, k) => (
                  <rect key={y} x="76" y={y} width={k === 2 ? 48 : 84} height="8" rx="4" fill={INK.brown} fillOpacity=".28" />
                ))}
              </>
            )}
          </g>
        ))}
      </Lift>
      <Lift by={7}>
        <SignInScene sign="talk" x={150} y={120} w={150} h={80} />
      </Lift>
    </SceneSvg>
  );
}
