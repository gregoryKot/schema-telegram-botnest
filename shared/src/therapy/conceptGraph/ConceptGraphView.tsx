import { useTr } from '../../utils/addressForm';
import { buildConceptGraph } from './conceptGraphModel';
import {
  conceptGraphSource,
  type ConceptGraphFields,
} from './conceptGraphSource';
import { ConceptDiagram } from './diagram/ConceptDiagram';
import { ConceptGraphFooter } from './ConceptGraphFooter';
import { graphColumnStyle } from './graphStyles';

/**
 * Схема случая только для чтения — та, что клиент видит в «Мой терапевт», когда
 * терапевт включил «Показать клиенту». Та же диаграмма и та же модель, что у
 * терапевта (ConceptGraph), без редакторов, «+» и подсказок «чего не хватает»:
 * тап по фигуре подсвечивает её связи. Цикл режимов под схемой остаётся.
 */
export function ConceptGraphView({ fields }: { fields: ConceptGraphFields }) {
  const tr = useTr();
  const graph = buildConceptGraph(conceptGraphSource(fields), tr);
  return (
    <div style={graphColumnStyle}>
      <ConceptDiagram graph={graph} />
      <ConceptGraphFooter graph={graph} hints={false} />
    </div>
  );
}
