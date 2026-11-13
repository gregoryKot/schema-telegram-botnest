import { Skeleton } from './Skeleton';
import { PaperAlert } from './paper/PaperAlert';
import type { DayNoteStatus } from '../hooks/useDayNote';

/**
 * Лист заметки дня, пока заметка не пришла (аудит 2026-11, E7): формы нет,
 * чтобы набранное не затёр поздний ответ, а пустая форма после сбоя не легла
 * поверх сохранённой заметки. Загрузка — силуэт поля и тем по форме листа,
 * сбой — PaperAlert строкой с «Повторить».
 */
export function NoteLoadState({ status, onRetry }: { status: Exclude<DayNoteStatus, 'ready'>; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <PaperAlert sign="pebbles" title="Заметка не загрузилась."
        text="Поле откроется после загрузки, чтобы новое не легло поверх сохранённого." onRetry={onRetry} />
    );
  }
  return (
    <div role="status" aria-label="Загружается заметка" className="sd-note-form">
      <Skeleton height={200} radius={20} />
      <div className="sd-note-tags">
        <Skeleton width={90} height={12} />
        <div className="sd-note-chips">{[96, 120, 104, 132, 80].map(w => <Skeleton key={w} width={w} height={40} radius={20} />)}</div>
      </div>
    </div>
  );
}
