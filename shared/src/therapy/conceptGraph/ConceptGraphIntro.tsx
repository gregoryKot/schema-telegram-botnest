import { Disclosure } from '../../components/Disclosure';
import { useFoldClasses } from './conceptSkin';
import { ConceptGraphGuide } from './ConceptGraphGuide';
import type { NeedPctHintProps } from './NeedPctHint';

/** Как читать схему: свёрнуто; на пустой схеме её нет (ConceptGraph) — появляется вместе с диаграммой. В картинку не идёт. */
export function ConceptGraphIntro(p: NeedPctHintProps) {
  const f = useFoldClasses();
  return (
    <div data-export-skip>
      <Disclosure title="Как читать схему" classes={f}>
        <ConceptGraphGuide {...p} />
      </Disclosure>
    </div>
  );
}
