import { useTr } from '../../utils/addressForm';
import { ConceptFullscreenSheet } from '../../components/therapist/ConceptFullscreenSheet';
import { Skeleton } from '../../components/Skeleton';
import { ConceptGraphView } from '../../../../shared/src/therapy/conceptGraph/ConceptGraphView';
import { ConceptPaperProvider } from '../../components/therapist/concept/ConceptPaperProvider';
import { SignArt } from '../../components/art/SignArt';
import { useMyConcept } from './useMyConcept';
import { myConceptDates } from './myConceptModel';

// Лист «Схема случая» из «Мой терапевт»: схема, которую терапевт показал клиенту (только чтение, та же диаграмма
// и та же бумага, что у терапевта, — ConceptGraphView в ConceptPaperProvider). Сверху лист глины со знаком схем
// отвечает «откуда это и зачем»; лист — общий лист концептуализации (useHistorySheet внутри).
export function MyConceptSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const state = useMyConcept();
  const lede = tr(
    'Схема, которую ты собираешь с терапевтом: откуда берутся трудные состояния и на что можно опереться. Нажми на фигуру — подсветятся её связи.',
    'Схема, которую вы собираете с терапевтом: откуда берутся трудные состояния и на что можно опереться. Нажмите на фигуру — подсветятся её связи.',
  );
  return (
    <ConceptFullscreenSheet title="Схема случая" closeLabel="Закрыть" onClose={onClose}>
      <ConceptPaperProvider>
      <div className="pp-paper cg-my-hero"><SignArt sign="layers" size="square" /><p className="cg-my-lede">{lede}</p></div>
      {state.status === 'loading' && <Skeleton height={480} radius={20} />}
      {state.status === 'ready' && (
        <>
          <p className="cg-my-dates">{myConceptDates(state.concept.sharedWithClientAt, state.concept.updatedAt)}</p>
          <ConceptGraphView fields={state.concept} />
        </>
      )}
      {state.status === 'hidden' && (
        <p className="ds-empty">Терапевт сейчас её не показывает. Спросить о схеме можно на встрече.</p>
      )}
      {state.status === 'error' && (
        <p className="ds-empty" role="alert">
          {tr('Не получилось загрузить схему. Проверь интернет и открой её ещё раз.', 'Не получилось загрузить схему. Проверьте интернет и откройте её ещё раз.')}
        </p>
      )}
      </ConceptPaperProvider>
    </ConceptFullscreenSheet>
  );
}
