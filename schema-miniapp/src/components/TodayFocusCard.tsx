// Нейроинклюзивный экран «Сегодня», волна 1 (дизайн-макет ADHD-friendly).
// Одна главная задача с оценкой времени вместо нескольких равнозначных
// карточек: снижение когнитивной нагрузки (ADHD/РАС — один фокус, ясный
// следующий шаг; правило CLAUDE.md «одно очевидное главное действие
// на экран»). Когда трекер заполнен — спокойное состояние «на сегодня всё»,
// без давления сделать больше.
import { useTr } from '../utils/addressForm';
import { HeroCta } from './HeroCta';

interface Props {
  ratedCount: number;
  total: number;
  /** Средний индекс дня — есть только когда все потребности оценены */
  avgScore: string | null;
  onOpenTracker: () => void;
  onOpenHistory?: () => void;
  /** Поделиться карточкой заполненного дня (есть только когда день оценён) */
  onShareDay?: () => void;
}

export function TodayFocusCard({
  ratedCount,
  total,
  avgScore,
  onOpenTracker,
  onOpenHistory,
  onShareDay,
}: Props) {
  const tr = useTr();
  const allRated = total > 0 && ratedCount === total;
  const left = total - ratedCount;

  if (allRated && avgScore) {
    return (
      <div
        className="card"
        style={{
          padding: 18,
          animation: 'slide-up 0.3s ease both',
          animationDelay: '80ms',
        }}
      >
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
        {onShareDay && (
          <button
            onClick={onShareDay}
            style={{
              marginTop: 14,
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 44,
              borderRadius: 12,
              border:
                '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M12 15V4m0 0L8 8m4-4 4 4M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Поделиться днём
          </button>
        )}
      </div>
    );
  }

  // Крупная акцентная CTA по дизайн-макету — общий HeroCta
  return (
    <HeroCta
      label="Одно дело на сегодня"
      chip="⏱ ≈1 мин"
      title="Заполнить трекер потребностей"
      sub={
        ratedCount > 0
          ? `Осталось ${left} из ${total} — сохраняется само`
          : 'Пять оценок о том, как прошёл день. Сохраняется само.'
      }
      buttonLabel={ratedCount > 0 ? 'Продолжить' : 'Начать'}
      onClick={onOpenTracker}
    />
  );
}
