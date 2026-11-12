import { Disclosure } from '../../components/Disclosure';
import { useFoldClasses } from './conceptSkin';
import { ConceptGraphGuide } from './ConceptGraphGuide';
import type { ConceptGraphModel } from './conceptGraphTypes';

/** Как читать схему: свёрнуто, открыто само на пустой; в картинку не идёт. */
export function ConceptGraphIntro({ graph }: { graph: ConceptGraphModel }) {
  const f = useFoldClasses();
  const empty = graph.modeCount === 0 && graph.schemas.length === 0;
  return (
    <div data-export-skip>
      <Disclosure title="Как читать схему" defaultOpen={empty} classes={f}>
        <ConceptGraphGuide needLinks={graph.needLinks} />
      </Disclosure>
    </div>
  );
}
