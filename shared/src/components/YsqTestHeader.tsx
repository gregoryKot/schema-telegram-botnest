// Шапка полноэкранной фазы теста на схемы (назад / счётчик / закрыть /
// прогресс-бар) — одна копия для обоих фронтендов (правило №3).
import { TOTAL_PAGES } from '../hooks/useYsqTest';

export function YsqTestHeader({
  page,
  onBack,
  onClose,
}: {
  page: number;
  onBack: () => void;
  onClose: () => void;
}) {
  const progressPct = ((page + 1) / TOTAL_PAGES) * 100;
  return (
    <div style={{ flexShrink: 0, padding: '16px 20px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <button
          onClick={onBack}
          disabled={page === 0}
          aria-label="Назад"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: 'none',
            background: page === 0 ? 'transparent' : 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text-sub)',
            fontSize: 16,
            cursor: page === 0 ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: page === 0 ? 0 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {page + 1} / {TOTAL_PAGES}
        </span>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text-sub)',
            fontSize: 17,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          height: 3,
          background: 'rgba(var(--fg-rgb),0.08)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--accent)',
            borderRadius: 3,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}
