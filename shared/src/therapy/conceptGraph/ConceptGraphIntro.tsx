import { Disclosure } from '../../components/Disclosure';
import { ConceptGaps } from './ConceptGaps';
import { ConceptGraphGuide } from './ConceptGraphGuide';
import type { ConceptGraphModel } from './conceptGraphTypes';

/**
 * Как читать схему (CLAUDE.md, «Онбординг и очевидность»): свёрнуто, открыто
 * само только на пустой схеме. Подсказки «чего не хватает» — тоже подсказки,
 * не данные клиента: лежат под инструкцией.
 */
export function ConceptGraphIntro({ graph }: { graph: ConceptGraphModel }) {
  const empty = graph.modeCount === 0 && graph.schemas.length === 0;
  return (
    <Disclosure title="Как читать схему" defaultOpen={empty}>
      <ConceptGraphGuide>
        <ConceptGaps gaps={graph.gaps} />
      </ConceptGraphGuide>
    </Disclosure>
  );
}
