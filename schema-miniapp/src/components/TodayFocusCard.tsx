// Нейроинклюзивный экран «Сегодня» (дизайн-макет ADHD-friendly).
// Одна главная задача с оценкой времени; какая именно — выбирает пользователь
// (utils/todayFocus: трекер / дневник схем / режимов / благодарность).
// Выполнено — спокойное «на сегодня всё», без давления сделать больше.
import { useTr } from '../utils/addressForm';
import { HeroCta } from './HeroCta';
import { FocusPractice, focusCardContent } from '../utils/todayFocus';

interface Props {
  practice: FocusPractice;
  ratedCount: number;
  total: number;
  /** Средний индекс дня — есть только когда все потребности оценены */
  avgScore: string | null;
  /** Сделана ли сегодня запись выбранной дневниковой практики */
  practiceDoneToday?: boolean;
  /** Открыть трекер или форму выбранного дневника */
  onAction: () => void;
  onOpenHistory?: () => void;
  /** Кнопка «Поделиться днём» (DayShareButton) — показывается когда день оценён */
  shareSlot?: React.ReactNode;
}

export function TodayFocusCard({
  practice,
  ratedCount,
  total,
  avgScore,
  practiceDoneToday,
  onAction,
  onOpenHistory,
  shareSlot,
}: Props) {
  const tr = useTr();
  const isTracker = practice === 'tracker';
  const allRated = total > 0 && ratedCount === total;
  const content = focusCardContent(practice, ratedCount, total);
  const done = isTracker ? allRated && !!avgScore : !!practiceDoneToday;

  if (done) {
    const sideAction = isTracker ? onOpenHistory : onAction;
    const sideLabel = isTracker ? 'История' : 'Ещё';
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
              {isTracker ? `Индекс дня ${avgScore}/10.` : content.doneSub}{' '}
              {tr(
                'Загляни завтра — или посмотри историю',
                'Загляните завтра — или посмотрите историю',
              )}
            </div>
          </div>
          {sideAction && (
            <button
              onClick={sideAction}
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
              {sideLabel}
            </button>
          )}
        </div>
        {isTracker && shareSlot && (
          <div style={{ marginTop: 14 }}>{shareSlot}</div>
        )}
      </div>
    );
  }

  // Крупная акцентная CTA по дизайн-макету — общий HeroCta
  return (
    <HeroCta
      label="Одно дело на сегодня"
      chip={content.chip}
      title={content.title}
      sub={content.sub}
      buttonLabel={content.buttonLabel}
      onClick={onAction}
    />
  );
}
