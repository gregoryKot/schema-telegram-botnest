import { Disclosure } from '../../components/Disclosure';
import { ConceptGaps } from './ConceptGaps';
import type { ConceptGraphModel } from './conceptGraphTypes';
import { hintStyle } from './graphStyles';

/**
 * Под схемой: порядок смены режимов (данные клиента — виден всегда и идёт в
 * картинку) и мягкие подсказки «чего не хватает», свёрнутые в «Подсказки по
 * схеме · N». Подсказки стоят под схемой, а не над ней: плашка, появившаяся
 * после тапа в выборе «+ режим», не сдвигает схему и выбор под пальцем (#887).
 * В картинку подсказки не идут — это повод для разговора, а не схема случая.
 */
export function ConceptGraphFooter({ graph }: { graph: ConceptGraphModel }) {
  return (
    <>
      {graph.sequence && (
        <p style={{ ...hintStyle, margin: 0 }}>
          <b>Как режимы сменяют друг друга:</b> <span>{graph.sequence}</span>
        </p>
      )}
      {graph.gaps.length > 0 && (
        <div data-export-skip>
          <Disclosure title={`Подсказки по схеме · ${graph.gaps.length}`}>
            <ConceptGaps gaps={graph.gaps} />
          </Disclosure>
        </div>
      )}
    </>
  );
}
