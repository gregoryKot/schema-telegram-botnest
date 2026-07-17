// Нейроинклюзивный экран «Сегодня», волна 1 (дизайн-макет ADHD-friendly).
// Одна главная задача с оценкой времени вместо нескольких равнозначных
// карточек: снижение когнитивной нагрузки (ADHD/РАС — один фокус, ясный
// следующий шаг; правило CLAUDE.md «одно очевидное главное действие
// на экран»). Когда трекер заполнен — спокойное состояние «на сегодня всё»,
// без давления сделать больше.
import { useTr } from '../utils/addressForm';

interface Props {
  ratedCount: number;
  total: number;
  /** Средний индекс дня — есть только когда все потребности оценены */
  avgScore: string | null;
  onOpenTracker: () => void;
  onOpenHistory?: () => void;
}

export function TodayFocusCard({
  ratedCount,
  total,
  avgScore,
  onOpenTracker,
  onOpenHistory,
}: Props) {
  const tr = useTr();
  const allRated = total > 0 && ratedCount === total;
  const left = total - ratedCount;

  if (allRated && avgScore) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              flexShrink: 0,
              fontSize: 22,
              background:
                'color-mix(in srgb, var(--accent-green) 12%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}
            >
              На сегодня — всё
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              Индекс дня {avgScore}/10.{' '}
              {tr(
                'Загляни завтра — или посмотри историю',
                'Загляните завтра — или посмотрите историю',
              )}
            </div>
          </div>
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              style={{
                background:
                  'color-mix(in srgb, var(--accent) 10%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              История
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="card"
      onClick={onOpenTracker}
      style={{
        padding: 18,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))',
        border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          Одно дело на сегодня
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-sub)',
            flexShrink: 0,
            background: 'rgba(var(--fg-rgb),0.06)',
            padding: '3px 10px',
            borderRadius: 99,
          }}
        >
          ⏱ ≈1 мин
        </div>
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.3,
        }}
      >
        Отметить, как прошёл день
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 5,
          lineHeight: 1.5,
        }}
      >
        {ratedCount > 0
          ? `Осталось ${left} из ${total} — сохраняется само`
          : 'Пять оценок потребностей — сохраняется само'}
      </div>
      <button className="btn-primary" style={{ marginTop: 14 }}>
        {ratedCount > 0 ? 'Продолжить' : 'Начать'} →
      </button>
    </div>
  );
}
