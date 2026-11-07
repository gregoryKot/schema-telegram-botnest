import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import { ConceptTabHead } from './concept/ConceptTabHead';
import { ConceptFoldouts } from './concept/ConceptFoldouts';
import { ConceptModeIdsContext } from './concept/modeChain';
import { CONCEPT_SITE_SKIN } from './concept/conceptSiteSkin';
import { ConceptSkinContext } from '../../../../shared/src/therapy/conceptGraph/conceptSkin';
import '../../styles/therapist-concept.css';
import { useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { ConceptDigest, useConceptDigest } from '../../../../shared/src/therapy/conceptGraph/ConceptDigest';

import type { AssignPreset } from './assignTemplates';

interface Props { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void; onAssign?: (preset: AssignPreset) => void }
// Вкладка «Концептуализация»: шапка, сводка, вид «Схема» или «Поля», раскрывашки; ds-вид — контекстом (CONCEPT_SITE_SKIN).
export function ClientConceptTab({ detail, onOpenCanvas, onAssign }: Props) {
  const [view, setView] = useConceptView(detail.activeModeIds.length); // раз при открытии (см. хук)
  const head = { detail, view, onView: setView };
  const digest = <ConceptDigest rows={useConceptDigest(detail.concept, detail.localConcept)} />;
  return (
    <ConceptSkinContext.Provider value={CONCEPT_SITE_SKIN}>
    <div className={`page-inner-wide tcp-page${view === 'graph' ? ' tcp--graph' : ''}`}>
      {view === 'graph' ? (
        <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} onAssign={onAssign} head={head} digest={digest} />
      ) : (
        <>
          <ConceptTabHead {...head} />
          {digest}
          {/* Цепочка «Переключение режимов» — из режимов клиента (modeChain.ts). */}
          <ConceptModeIdsContext.Provider value={detail.activeModeIds}>
            <ClientConceptFields detail={detail} onGoToGraph={() => setView('graph')} />
          </ConceptModeIdsContext.Provider>
        </>
      )}
      <ConceptFoldouts detail={detail} />
    </div>
    </ConceptSkinContext.Provider>
  );
}
