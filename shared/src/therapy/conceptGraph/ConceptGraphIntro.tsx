import { Disclosure } from '../../components/Disclosure';
import { useFoldClasses } from './conceptSkin';
import { ConceptGraphGuide } from './ConceptGraphGuide';

/** Как читать схему: свёрнуто всегда (на пустой схеме — тоже); в картинку не идёт. */
export function ConceptGraphIntro() {
  const f = useFoldClasses();
  return (
    <div data-export-skip>
      <Disclosure title="Как читать схему" classes={f}>
        <ConceptGraphGuide />
      </Disclosure>
    </div>
  );
}
