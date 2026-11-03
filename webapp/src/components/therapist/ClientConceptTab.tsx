import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import { ConceptTabHead } from './concept/ConceptTabHead';
import { ConceptFoldouts } from './concept/ConceptFoldouts';
import '../../styles/therapist-concept.css';
import { useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { ConceptDigest, useConceptDigest } from '../../../../shared/src/therapy/conceptGraph/ConceptDigest';

interface Props { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }

// Вкладка «Концептуализация»: шапка (ConceptTabHead), сводка «Коротко» (ConceptDigest, #902 — что с клиентом,
// первым экраном в обоих видах), вид «Схема» или «Поля», ниже раскрывашки (ConceptFoldouts) — одна колонка.
// В виде «Схема» шапку и сводку рисует ClientConceptGraph (пропы head, digest): его действия уходят в меню
// «⋯ Ещё», данные и обработчики — в одном месте. Класс tcp--graph сужает отступы: схеме нужно 960px на 4 колонки.
export function ClientConceptTab({ detail, onOpenCanvas }: Props) {
  const [view, setView] = useConceptView(detail.activeModeIds.length); // раз при открытии (см. хук)
  const head = { detail, view, onView: setView };
  const digest = <ConceptDigest rows={useConceptDigest(detail.concept, detail.localConcept)} />;

  return (
    <div className={`page-inner-wide tcp-page${view === 'graph' ? ' tcp--graph' : ''}`}>
      {view === 'graph' ? (
        <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} head={head} digest={digest} />
      ) : (
        <>
          <ConceptTabHead {...head} />
          {digest}
          <ClientConceptFields detail={detail} onGoToGraph={() => setView('graph')} />
        </>
      )}
      <ConceptFoldouts detail={detail} />
    </div>
  );
}
