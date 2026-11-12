// Сцена «Письмо себе в детстве» (docs/design/PAPER_2026-11.md, «Сцены приложения»: SceneLetter, b18) на
// сирени письма (ENTITY_LOOK.letter). Два состояния одного письма:
//  • пишется — белый лист с полями лежит на втором листе шалфея; в углу, как марка, — ChildCare (кому
//    письмо: детской части, о которой заботятся); строки — только написанные: `lines` из текста
//    (letterLines), пустое письмо — чистый лист с полями и приветствием, без выдуманных строк;
//  • запечатано — тот же лист сложен в конверт, на клапане печатью — тот же ChildCare: сказанное
//    запечатано и отдано детской части.
// Каркас — sceneKit (лист-подложка, квадратик второй бумаги, тень сплошным слоем Lift); ChildCare не
// перерисован — тот же мотив по ключу (SignInScene). Декор: смысл несёт заголовок рядом.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SignInScene } from './AppScenes';

/** Поля и сгибы листа — тон глины на белом, строки — чернила сланца, клапан — сирень по белому. */
const MARGIN = 'color-mix(in srgb, var(--c-clay) 45%, var(--surface))';
const FOLD = 'color-mix(in srgb, var(--c-plum) 30%, var(--surface))';
const FLAP = 'color-mix(in srgb, var(--c-plum) 14%, var(--surface))';

/** Длины строк письма по порядку (единицы холста): разные, как у живого текста. */
const LETTER_LINE_LEN = [92, 78, 96, 60, 86, 50] as const;

function Writing({ lines }: { lines: number }) {
  return (
    <g transform="rotate(-4 157 129)">
      <path d="M106 48 V212" stroke={MARGIN} strokeWidth="2.5" />
      <path d="M118 62 H150" stroke={INK.plum} strokeWidth="6" strokeLinecap="round" />
      {LETTER_LINE_LEN.slice(0, lines).map((len, i) => (
        <path key={i} data-line="" d={`M118 ${88 + i * 20} h${len}`} stroke={INK.slate} strokeWidth="5" strokeLinecap="round" />
      ))}
      <SignInScene sign="child_care" x={184} y={40} w={42} h={23} />
    </g>
  );
}

function Envelope() {
  return (
    <g transform="rotate(-3 160 152)">
      <Lift by={6}>
        <rect x="46" y="82" width="228" height="142" rx="12" fill={INK.sheet} />
      </Lift>
      <path d="M58 216 L160 158 L262 216" fill="none" stroke={FOLD} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 86 L160 162 L270 86 Z" fill={FLAP} stroke={FOLD} strokeWidth="3" strokeLinejoin="round" />
      <Lift by={4}>
        <SignInScene sign="child_care" x={116} y={126} w={88} h={47} />
      </Lift>
    </g>
  );
}

/** Письмо: `lines` — сколько строк уже написано (0–6), `sealed` — конверт с печатью. */
export function SceneLetter({ lines = 0, sealed = false, hue = 290 }: { lines?: number; sealed?: boolean; hue?: number }) {
  const shown = Math.max(0, Math.min(LETTER_LINE_LEN.length, Math.floor(lines)));
  return (
    <SceneSvg hue={hue} patch={135} patchAt={sealed ? 'tr' : 'bl'} sheet={sealed ? 'b' : 'a'} className="scn-letter">
      {sealed ? <Envelope /> : (
        <>
          <Lift by={6}>
            <rect x="98" y="42" width="144" height="182" rx="10" transform="rotate(7 170 133)" fill={INK.sage} />
            <rect x="82" y="34" width="150" height="190" rx="10" transform="rotate(-4 157 129)" fill={INK.sheet} />
          </Lift>
          <Writing lines={shown} />
        </>
      )}
    </SceneSvg>
  );
}
