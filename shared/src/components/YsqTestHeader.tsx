// Шапка полноэкранной фазы теста на схемы (назад / счётчик / закрыть /
// прогресс-бар) — одна копия для обоих фронтендов (правило №3).
import { TOTAL_PAGES } from '../hooks/useYsqTest';
import { hitboxStyle } from '../utils/hitbox';

export function YsqTestHeader({
  page,
  onBack,
  onClose,
  topInset = 0,
}: {
  page: number;
  onBack: () => void;
  onClose: () => void;
  /** Safe-area сверху (мини-апп: панель Telegram перекрывает шапку и
      прогресс-шкалу). Webapp передаёт 0. */
  topInset?: number;
}) {
  const progressPct = ((page + 1) / TOTAL_PAGES) * 100;
  return (
    <div style={{ flexShrink: 0, padding: `${16 + topInset}px 20px 0` }}>
      <div className="u-between-mb10">
        <button
          onClick={onBack}
          disabled={page === 0}
          aria-label="Назад"
          style={{
            ...hitboxStyle(36, 36, 44).outer,
            cursor: page === 0 ? 'default' : 'pointer',
          }}
        >
          <span
            style={{
              ...hitboxStyle(36, 36, 44).inner,
              borderRadius: 12,
              background:
                page === 0 ? 'transparent' : 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text-sub)',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: page === 0 ? 0 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            ←
          </span>
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
          style={hitboxStyle(36, 36, 44).outer}
        >
          <span
            style={{
              ...hitboxStyle(36, 36, 44).inner,
              borderRadius: 12,
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text-sub)',
              fontSize: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </span>
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
