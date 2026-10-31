import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import { ConceptTabHead } from './concept/ConceptTabHead';
import { ConceptFoldouts } from './concept/ConceptFoldouts';
import { ConceptModeIdsContext } from './concept/modeChain';
import '../../styles/therapist-concept.css';
import { useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';

interface Props { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }

// Вкладка «Концептуализация» кабинета: шапка (ConceptTabHead), один из двух видов и
// под ним свёрнутые сверка с YSQ и история версий (ConceptFoldouts) — одна колонка
// в обоих видах. В виде «Схема» шапку рисует ClientConceptGraph (проп head): так
// его действия (картинка, холст, весь экран) попадают в меню «⋯ Ещё», а данные
// схемы и обработчики остаются в одном месте. Класс tcp--graph сужает
// отступы вкладки, чтобы на ноутбуке схеме хватило 960px на четыре колонки.
export function ClientConceptTab({ detail, onOpenCanvas }: Props) {
  // Вид выбирается один раз при открытии вкладки (см. useConceptView).
  const [view, setView] = useConceptView(detail.activeModeIds.length);
  const head = { detail, view, onView: setView };

  return (
    <div className={`page-inner-wide u-pt40${view === 'graph' ? ' tcp--graph' : ''}`}>
      {view === 'graph' ? (
        <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} head={head} />
      ) : (
        <>
          <ConceptTabHead {...head} />
          {/* Цепочка «Переключение режимов» — из режимов клиента (modeChain.ts). */}
          <ConceptModeIdsContext.Provider value={detail.activeModeIds}>
            <ClientConceptFields detail={detail} onGoToGraph={() => setView('graph')} />
          </ConceptModeIdsContext.Provider>
        </>
      )}
      <ConceptFoldouts detail={detail} />
    </div>
  );
}
