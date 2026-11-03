// Подвал завершённой практики для сайта:
// подпись счётчика слева (ds-sub), «поделиться →» ссылкой ds-link.
// Тот же контракт, что у PracticeDoneFooter (мини-апп); выбирает площадка.
import { useEffect } from 'react';
import { pluralRu } from '../utils/pluralRu';
import type { PracticeDoneFooterProps } from './PracticeDoneFooter';

export function PracticeDoneFooterSite({
  count,
  onShare,
  onShown,
}: PracticeDoneFooterProps) {
  useEffect(() => {
    onShown?.();
  }, [onShown]);

  return (
    <div
      style={{
        marginTop: 'var(--space-8)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-8) var(--space-16)',
      }}
    >
      {count != null && count > 0 && (
        <div className="ds-sub">
          Пройдено уже {count} {pluralRu(count, 'раз', 'раза', 'раз')}
        </div>
      )}
      <button
        type="button"
        className="ds-link"
        onClick={onShare}
        style={{ marginLeft: 'auto' }}
      >
        поделиться →
      </button>
    </div>
  );
}
