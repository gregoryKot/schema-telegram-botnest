// Подвал завершённой практики для сайта: подпись счётчика слева (ds-sub, на цветном
// листе — класс pf-count тоном --text-sub), «поделиться →» ссылкой ds-link: со счётчиком — у правого
// края (space-between), без него — с начала строки, а не одна посреди ряда (ревью g4); лист дыхания
// ставит её сразу за счётчиком (packed).
// Тот же контракт, что у PracticeDoneFooter (мини-апп); выбирает площадка.
import { useEffect } from 'react';
import { pluralRu } from '../utils/pluralRu';
import type { PracticeDoneFooterProps } from './PracticeDoneFooter';

/** packed — «поделиться» сразу за счётчиком, а не у правого края (лист дыхания: на широком листе
 *  край колонки текста висел посреди карточки между текстом и сценой). */
export function PracticeDoneFooterSite({
  count,
  onShare,
  onShown,
  packed = false,
}: PracticeDoneFooterProps & { packed?: boolean }) {
  useEffect(() => {
    onShown?.();
  }, [onShown]);

  return (
    <div
      className="pf-foot"
      style={{
        marginTop: 'var(--space-8)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: packed ? 'flex-start' : 'space-between',
        gap: 'var(--space-8) var(--space-16)',
      }}
    >
      {count != null && count > 0 && (
        <div className="ds-sub pf-count">
          Пройдено уже {count} {pluralRu(count, 'раз', 'раза', 'раз')}
        </div>
      )}
      <button type="button" className="ds-link" onClick={onShare}>
        поделиться →
      </button>
    </div>
  );
}
