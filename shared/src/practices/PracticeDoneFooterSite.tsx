// Подвал завершённой практики для сайта (variant="site" у PracticeDoneFooter):
// подпись счётчика слева, «поделиться →» текстовой ссылкой цветом --accent.
import { pluralRu } from '../utils/pluralRu';

export function PracticeDoneFooterSite({
  count,
  onShare,
}: {
  count: number | null;
  onShare: () => void;
}) {
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
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Пройдено уже {count} {pluralRu(count, 'раз', 'раза', 'раз')}
        </div>
      )}
      <button
        onClick={onShare}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 500,
          padding: 0,
          minHeight: 44,
          marginLeft: 'auto',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        поделиться →
      </button>
    </div>
  );
}
