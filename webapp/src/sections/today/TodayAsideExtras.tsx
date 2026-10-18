import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { useStreakHidden } from './useTodayFocusPrefs';

// Стрик: цифра --accent-hot 52px.
function StreakCard({ streak, onHide }: { streak: number; onHide?: () => void }) {
  const tr = useTr();
  return (
    <div className="ds-card ct-streak">
      <div className={'ds-num ct-streak-num' + (streak > 0 ? '' : ' is-zero')}>{streak}</div>
      <div>
        <div className="ct-streak-label">
          {streak === 0 ? tr('Оцени потребности – начнётся стрик', 'Оцените потребности – начнётся стрик') : 'дней подряд'}
        </div>
      </div>
      {onHide && <button type="button" className="ct-streak-hide" onClick={onHide}>Скрыть</button>}
    </div>
  );
}

/** Карточка серии со скрытием; скрытую заменяет ссылка «Показать». Флаг общий с мини-аппом. */
export function StreakSlot({ streak }: { streak: number }) {
  const { streakHidden, toggleStreak } = useStreakHidden();
  return streakHidden
    ? <button type="button" className="ct-streak-hide" onClick={toggleStreak}>Показать серию дней</button>
    : <StreakCard streak={streak} onHide={toggleStreak} />;
}

/** Ссылка в кабинет терапевта (роль THERAPIST). */
export function TherapistLink({ onOpen }: { onOpen: () => void }) {
  return (
    <div {...pressable(onOpen)} className="ds-card ds-card--row ds-card--hover ct-therapist-link">
      <div className="ct-task-body">
        <div className="ds-label">Терапевт</div>
        <div className="ct-task-text">Кабинет терапевта</div>
        <div className="ds-sub">Клиенты · Задания · Концептуализация</div>
      </div>
      <span className="ds-link">открыть →</span>
    </div>
  );
}
