import type { MoreState } from './useDiaryLists';

// «Показать ещё» под лентой «Записей»: догружает записи старше показанных.
// Сбой — честная строка и та же кнопка для повтора, лента остаётся на месте.
export function DiaryMore({ state, onMore }: { state: MoreState; onMore: () => void }) {
  return (
    <>
      {state === 'failed' && <p className="cd-streak" role="status">Более ранние записи не загрузились.</p>}
      <button type="button" className="ds-btn ds-btn--secondary" disabled={state === 'loading'} onClick={onMore}>
        {state === 'loading' ? 'Загружаю…' : state === 'failed' ? 'Повторить' : 'Показать ещё'}
      </button>
    </>
  );
}
