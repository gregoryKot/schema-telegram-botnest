// Сцена «Мне плохо» (docs/design/PAPER_2026-11.md, «Сцены приложения»: SceneSos — герой «Мне плохо»,
// b12): на бережной бумаге розы сердце глины стоит на земле между двумя дугами дыхания — тот же
// мотив, что знак Breath, только в середине вместо камешка — сердце: кривая знака Heart (HEART_PATH
// из PaperArtSigns.tsx, одна на знак, сцену и HeartFrame) чернилами глины. Бережно, и дыхание —
// первая помощь. Каркас — sceneKit (лист-подложка по --h, квадратик шалфея — «станет легче», тень
// сплошным сдвинутым слоем Lift). Движения нет: дуги не дышат сами — дышит человек (бесконечной
// анимации в продукте нет). Декор: смысл несёт «Всё правильно» рядом.
import { HEART_PATH } from './PaperArtSigns';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

export function SceneSos({ hue = 25 }: { hue?: number }) {
  const arc = { fill: 'none', strokeWidth: 22, strokeLinecap: 'round' } as const;
  return (
    <SceneSvg hue={hue} patch={135} patchAt="tr" sheet="a" className="scn-sos">
      <Lift>
        <path d="M34 212 H286" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <path d="M54 200 A106 106 0 0 1 266 200" stroke={INK.sage} {...arc} />
        <path d="M94 200 A66 66 0 0 1 226 200" stroke={INK.moss} {...arc} />
      </Lift>
      <Lift by={7}>
        <path d={HEART_PATH} transform="translate(103 149) scale(0.95)" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}
