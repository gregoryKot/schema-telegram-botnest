import type { ClientDetail } from '../clientSheetTypes';
import { PaperAlert } from '../../paper/PaperAlert';

// Концептуализация не загрузилась (docs/open/therapy.md, класс «сбой ≠ пусто»): раньше вкладка рисовала
// пустые поля, это читалось как «её ещё нет», а первая правка уходила телом со ВСЕМИ полями и затирала
// сохранённое. Пока ответа нет, вместо полей — лист-сбой (PaperAlert, без красного: записанное цело);
// «Повторить» — тот же запрос заново.
export function ConceptLoadFailed({ load, onRetry }: { load: ClientDetail['conceptLoad']; onRetry: () => void }) {
  return (
    <div className="page-inner-wide tcp-page">
      <PaperAlert sign="layers" title="Концептуализация не загрузилась." text="Записанное на сервере цело — поля откроются, когда она придёт"
        onRetry={onRetry} retrying={load.reloading} retryLabel={load.reloading ? 'Загружаю…' : 'Повторить'} />
    </div>
  );
}
