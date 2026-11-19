// «Что это за потребность» на экране вопроса: описание — всегда, два примера из пула (exampleRotation) — под тапом.
// На низком телефоне (useLowPhone) под тап уходит и описание: иначе пятый ответ под сгибом (tracker-fit.spec.ts).
import type { NeedExtra } from '../../../../shared/src/needs/types';
import { useExampleWindow } from '../../../../shared/src/needs/exampleRotation';
import { glue } from '../../../../shared/src/utils/typo';
import { useLowPhone } from '../useLowPhone';
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
