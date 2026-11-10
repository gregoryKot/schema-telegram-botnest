// «Что это за потребность» прямо на экране вопроса (правило онбординга: «откуда это
// и зачем» — на пути, а не за ссылкой; владелец 2026-10-27). Описание — всегда; два
// примера — в <details> «Например», свёрнуты и раскрываются по тапу: раскрытые сразу,
// они на 390×664 и 360×640 сталкивали все пять ответов за край (QA мобильной, З5).
import type { NeedExtra } from '../../../../shared/src/needs/types';
import { glue } from '../../../../shared/src/utils/typo';
const EXAMPLES_SHOWN = 2;

export function NeedExplainer({ data }: { data: NeedExtra | undefined }) {
  if (!data) return null;
  const examples = data.examples.slice(0, EXAMPLES_SHOWN);
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
