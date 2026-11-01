import { Disclosure } from '../../components/Disclosure';
import { ConceptGraphGuide } from './ConceptGraphGuide';
import type { ConceptGraphModel } from './conceptGraphTypes';

/**
 * Как читать схему (CLAUDE.md, «Онбординг и очевидность»): свёрнуто, открыто
 * само только на пустой схеме. В «Скачать картинкой» не идёт (data-export-skip):
 * это подсказка интерфейса, а не схема случая. Подсказки о пробелах — под схемой.
 */
export function ConceptGraphIntro({ graph }: { graph: ConceptGraphModel }) {
  const empty = graph.modeCount === 0 && graph.schemas.length === 0;
  return (
    <div data-export-skip>
      <Disclosure title="Как читать схему" defaultOpen={empty}>
        <ConceptGraphGuide />
      </Disclosure>
    </div>
  );
}
