import { Disclosure } from '../../components/Disclosure';
import { ConceptGaps } from './ConceptGaps';
import type { ConceptGraphModel } from './conceptGraphTypes';
import { useFoldClasses } from './conceptSkin';
import { hintStyle } from './graphStyles';

/**
 * Под схемой: порядок смены режимов (данные клиента — виден всегда и идёт в
 * картинку) и мягкие подсказки «чего не хватает», свёрнутые в «Подсказки по
 * схеме · N». Подсказки стоят под схемой, а не над ней: плашка, появившаяся
 * после тапа в выборе «+ режим», не сдвигает схему и выбор под пальцем (#887).
 * В картинку подсказки не идут — это повод для разговора, а не схема случая.
 */
export function ConceptGraphFooter({
  graph,
  hints = true,
}: {
  graph: ConceptGraphModel;
  /** Подсказки — терапевту; на схеме клиента (только чтение) их нет. */
  hints?: boolean;
}) {
  const classes = useFoldClasses();
  return (
    <>
      {graph.sequence && (
        <p style={{ ...hintStyle, margin: 0 }}>
          <b>Как режимы сменяют друг друга:</b> <span>{graph.sequence}</span>
        </p>
      )}
      {hints && graph.gaps.length > 0 && (
        <div data-export-skip>
          <Disclosure
            title={`Подсказки по схеме · ${graph.gaps.length}`}
            classes={classes}
          >
            <ConceptGaps gaps={graph.gaps} />
          </Disclosure>
        </div>
      )}
    </>
  );
}
