// «Что это за потребность» прямо на экране вопроса (правило онбординга: «откуда это
// и зачем» — на пути, а не за ссылкой; владелец 2026-10-27). Описание — всегда; два
// примера — в <details> «Например», свёрнуты и раскрываются по тапу: раскрытые сразу,
// они на 390×664 и 360×640 сталкивали все пять ответов за край (QA мобильной, З5).
// Примеры меняются с каждым открытием вопроса: окно из большого пула (exampleRotation).
// На низком телефоне (LOW_PHONE_MEDIA) и описание уходит под тап — «Что это и примеры»:
// иначе пятый ответ под сгибом (e2e-browser/tracker-fit.spec.ts).
import type { NeedExtra } from '../../../../shared/src/needs/types';
import { useExampleWindow } from '../../../../shared/src/needs/exampleRotation';
import { glue } from '../../../../shared/src/utils/typo';
import { useLowPhone } from '../useIsMobile';
const EXAMPLES_SHOWN = 2;

export function NeedExplainer({ data }: { data: NeedExtra | undefined }) {
  const examples = useExampleWindow(data?.name ?? '', data?.examples, EXAMPLES_SHOWN);
  const low = useLowPhone();
  if (!data) return null;
  const desc = <p className="tq-desc">{glue(data.desc)}</p>;
  const folded = low && examples.length > 0;
  return (
    <>
      {!folded && desc}
      {examples.length > 0 && (
        <details className="tq-examples">
          <summary className="tq-examples-sum">{folded ? 'Что это и примеры' : 'Например'}</summary>
          {folded && desc}
          <ul className="tq-examples-list">
            {examples.map((ex) => (
              <li key={ex}>{glue(ex)}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
