import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import { ConceptTabHead } from './concept/ConceptTabHead';
import { ConceptFoldouts } from './concept/ConceptFoldouts';
import { ConceptModeIdsContext } from './concept/modeChain';
import { ConceptPaperProvider } from './concept/ConceptPaperProvider';
import { SceneConceptStart } from '../art/AppScenesMore';
import '../../styles/therapist-concept.css';
import { useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { ConceptDigest, useConceptDigest } from '../../../../shared/src/therapy/conceptGraph/ConceptDigest';
import { ConceptLoadFailed } from './concept/ConceptLoadFailed';
import type { AssignPreset } from './assignTemplates';

interface Props {
  detail: ClientDetail; onOpenCanvas?: (mapId: number) => void; onAssign?: (preset: AssignPreset) => void;
  /** «журнал →» у «делали …» в подсказках: журнал техник во вкладке «Задания». */
  onOpenJournal?: () => void;
}
// Вкладка «Концептуализация»: шапка, сводка, вид «Схема» или «Поля», раскрывашки; вид — контекстом (ConceptPaperProvider).
// Загрузка упала — вместо полей плашка с «Повторить»; тело монтируется, когда ответ пришёл, и вид выбирает по нему.
export function ClientConceptTab(props: Props) {
  const { conceptLoad, reloadConcept } = props.detail;
  return conceptLoad.failed ? <ConceptLoadFailed load={conceptLoad} onRetry={reloadConcept} /> : <ConceptTabBody {...props} />;
}

function ConceptTabBody({ detail, onOpenCanvas, onAssign, onOpenJournal }: Props) {
  const [view, setView] = useConceptView(detail.activeModeIds.length); // раз при открытии (см. хук)
  const head = { detail, view, onView: setView };
  const digest = <ConceptDigest rows={useConceptDigest(detail.concept, detail.localConcept)} />;
  return (
    <ConceptPaperProvider emptyScene={<SceneConceptStart />}>
    <div className={`page-inner-wide tcp-page${view === 'graph' ? ' tcp--graph' : ''}`}>
      {view === 'graph' ? (
        <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} onAssign={onAssign} onOpenJournal={onOpenJournal} head={head} digest={digest} />
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
    </ConceptPaperProvider>
  );
}
