import { Skeleton } from './Skeleton';
import type { DayNoteStatus } from '../hooks/useDayNote';

const field = { marginTop: 12 };

/**
 * Лист заметки дня, пока заметка не пришла (аудит 2026-11, E7): формы нет,
 * чтобы набранное не затёр поздний ответ, а пустая форма после сбоя не легла
 * поверх сохранённой заметки. Загрузка — силуэт тем и поля, сбой — строка и «Повторить».
 */
export function NoteLoadState({ status, onRetry }: { status: Exclude<DayNoteStatus, 'ready'>; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <div role="alert" className="ds-card sd-note-field">
        <p className="ds-empty">Заметка не загрузилась. Поле откроется после загрузки, чтобы новое не легло поверх сохранённого</p>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onRetry}>Повторить</button>
      </div>
    );
  }
  return (
    <div role="status" aria-label="Загружается заметка">
      <div className="ds-card sd-note-field">
        <Skeleton width="30%" height={12} />
        <Skeleton height={72} style={field} />
      </div>
      <div className="ds-card sd-note-field">
        <Skeleton width="20%" height={12} />
        <Skeleton height={120} style={field} />
      </div>
    </div>
  );
}
