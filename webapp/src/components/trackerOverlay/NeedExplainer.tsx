// «Что это за потребность» прямо на экране вопроса (правило онбординга: «откуда это
// и зачем» — на пути, а не за ссылкой; владелец 2026-10-27). Описание — всегда; два
// примера — в <details> «Например», свёрнуты и раскрываются по тапу: раскрытые сразу,
// они на 390×664 и 360×640 сталкивали все пять ответов за край (QA мобильной, З5).
// Примеры меняются с каждым открытием вопроса: окно из большого пула (exampleRotation).
import { useState } from 'react';
import type { NeedExtra } from '../../../../shared/src/needs/types';
import { exampleWindow, nextExampleStart } from '../../../../shared/src/needs/exampleRotation';
import { glue } from '../../../../shared/src/utils/typo';
const EXAMPLES_SHOWN = 2;

export function NeedExplainer({ data }: { data: NeedExtra | undefined }) {
  const [start] = useState(() => nextExampleStart(data?.name ?? '', data?.examples.length ?? 0, EXAMPLES_SHOWN));
  if (!data) return null;
  const examples = exampleWindow(data.examples, start, EXAMPLES_SHOWN);
  return (
    <>
      <p className="tq-desc">{glue(data.desc)}</p>
      {examples.length > 0 && (
        <details className="tq-examples">
          <summary className="tq-examples-sum">Например</summary>
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
