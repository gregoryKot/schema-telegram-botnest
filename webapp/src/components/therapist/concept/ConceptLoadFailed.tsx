import type { ClientDetail } from '../clientSheetTypes';

// Концептуализация не загрузилась (docs/open/therapy.md, класс «сбой ≠ пусто»): раньше вкладка рисовала
// пустые поля, это читалось как «её ещё нет», а первая правка уходила телом со ВСЕМИ полями и затирала
// сохранённое. Пока ответа нет, вместо полей — эта плашка; «Повторить» — тот же запрос заново.
export function ConceptLoadFailed({ load, onRetry }: { load: ClientDetail['conceptLoad']; onRetry: () => void }) {
  return (
    <div className="page-inner-wide tcp-page">
      <div role="alert" className="tc-alert">
        <p>Концептуализация не загрузилась. Записанное на сервере цело — поля откроются, когда она придёт</p>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onRetry} disabled={load.reloading} aria-busy={load.reloading || undefined}>
          {load.reloading ? 'Загружаю…' : 'Повторить'}
        </button>
      </div>
    </div>
  );
}
