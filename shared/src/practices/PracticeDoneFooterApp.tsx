// Подвал завершённой практики для мини-аппа (variant="app"): по центру,
// «Поделиться» плашкой. Логика — в PracticeDoneFooter.
import { pluralRu } from '../utils/pluralRu';

export function PracticeDoneFooterApp({
  count,
  onShare,
}: {
  count: number | null;
  onShare: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-8)',
      }}
    >
      {count != null && count > 0 && (
        // Безличная формулировка (правило CLAUDE.md об обращении): вилки по
        // роду в проекте нет («проходил»/«проходила» пришлось бы разводить),
        // поэтому фраза не зависит ни от формы обращения, ни от рода.
        <div className="u-sub12">
          Пройдено уже {count} {pluralRu(count, 'раз', 'раза', 'раз')}
        </div>
      )}
      <button
        onClick={onShare}
        style={{
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 700,
          padding: '9px 18px',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Поделиться
      </button>
    </div>
  );
}
