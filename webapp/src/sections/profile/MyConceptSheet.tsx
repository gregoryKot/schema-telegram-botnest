import { useTr } from '../../utils/addressForm';
import { ConceptFullscreenSheet } from '../../components/therapist/ConceptFullscreenSheet';
import { Skeleton } from '../../components/Skeleton';
import { ConceptGraphView } from '../../../../shared/src/therapy/conceptGraph/ConceptGraphView';
import { useMyConcept } from './useMyConcept';
import { myConceptDates } from './myConceptModel';

// Лист «Схема случая» из «Мой терапевт»: схема, которую терапевт показал клиенту (только
// чтение, та же диаграмма, что у терапевта, — ConceptGraphView). Первая строка отвечает
// «откуда это и зачем»; лист — общий лист концептуализации (useHistorySheet внутри).
export function MyConceptSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const state = useMyConcept();
  const lede = tr(
    'Схема, которую ты собираешь с терапевтом: откуда берутся трудные состояния и на что можно опереться. Нажми на фигуру — подсветятся её связи.',
    'Схема, которую вы собираете с терапевтом: откуда берутся трудные состояния и на что можно опереться. Нажмите на фигуру — подсветятся её связи.',
  );
  return (
    <ConceptFullscreenSheet
      title="Схема случая"
      closeLabel="Закрыть"
      onClose={onClose}
      sub={<p className="cpf-concept-lede">{lede}</p>}
    >
      {state.status === 'loading' && <Skeleton height={480} radius={20} />}
      {state.status === 'ready' && (
        <>
          <p className="cpf-concept-dates">{myConceptDates(state.concept.sharedWithClientAt, state.concept.updatedAt)}</p>
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
    </ConceptFullscreenSheet>
  );
}
