import { DS_FOLD, Disclosure } from '../../components/Disclosure';
import { ConceptGraphGuide } from './ConceptGraphGuide';

/** Как читать схему: свёрнуто; на пустой схеме её нет (ConceptGraph) — появляется вместе с диаграммой. В картинку не идёт. */
export function ConceptGraphIntro(p: Parameters<typeof ConceptGraphGuide>[0]) {
  return (
    <div data-export-skip>
      <Disclosure title="Как читать схему" classes={DS_FOLD}>
        <ConceptGraphGuide {...p} />
      </Disclosure>
    </div>
  );
}
