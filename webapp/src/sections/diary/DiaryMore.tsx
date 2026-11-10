import type { MoreState } from './useDiaryLists';
import { SignArt } from '../../components/art/SignArt';
import { PaperAlert } from '../../components/paper/PaperAlert';

// «Показать ещё» под лентой «Записей» — тихая ссылка по центру со знаком «Записей» (Sheets — то, что уже
// собрано), а не пилюля во всю ширину. Сбой — строка-лист PaperAlert с «Повторить», лента остаётся на месте.
export function DiaryMore({ state, onMore }: { state: MoreState; onMore: () => void }) {
  if (state === 'failed') return <PaperAlert title="Более ранние записи не загрузились." sign="sheets" role="status" onRetry={onMore} />;
  return (
    <button type="button" className="ds-link cd-more" disabled={state === 'loading'} aria-busy={state === 'loading' || undefined} onClick={onMore}>
      <span className="cd-more-sign" aria-hidden="true"><SignArt sign="sheets" size="nav" /></span>{state === 'loading' ? 'Загружаю…' : 'Показать ещё'}
    </button>
  );
}
