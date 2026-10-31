// «Что это за потребность» прямо на экране вопроса (правило онбординга:
// «откуда это и зачем» — на пути, а не за ссылкой). Владелец 2026-10-27:
// «людям непонятно, что такое потребности и как оценивать». Одна строка-описание
// всегда; два примера — раскрыты, пока потребность ещё не оценивали, потом
// свёрнуты в строку «Например» (нативный <details>, работает без JS).
import type { NeedExtra } from '../../../../shared/src/needs/types';

const EXAMPLES_SHOWN = 2;

export function NeedExplainer({ data, expanded }: { data: NeedExtra | undefined; expanded: boolean }) {
  if (!data) return null;
  const examples = data.examples.slice(0, EXAMPLES_SHOWN);
  return (
    <>
      <p className="tq-desc">{data.desc}</p>
      {examples.length > 0 && (
        <details className="tq-examples" open={expanded}>
          <summary className="tq-examples-sum">Например</summary>
          <ul className="tq-examples-list">
            {examples.map((ex) => (
              <li key={ex}>{ex}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
