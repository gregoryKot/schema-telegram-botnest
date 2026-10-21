import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { useIsMobile } from '../../components/useIsMobile';
import type { LongPressProps } from '../../../../shared/src/hooks/useLongPress';
import { PhoneStreakCard } from './PhoneStreakCard';

// Стрик: цифра --accent-hot 52px.
function StreakCard({ streak, onHide, hold }: { streak: number; onHide?: () => void; hold?: LongPressProps }) {
  const tr = useTr();
  return (
    <div {...hold} className="ds-card ct-streak">
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

/**
 * Карточка серии. Скрытие настраивается в листе «Настроить экран» (флаг общий
 * с мини-аппом, shared/today). На телефоне скрытая серия исчезает целиком; на
 * десктопе карточку можно скрыть прямо на ней, а скрытую заменяет ссылка
 * «Показать серию дней».
 */
export function StreakSlot({ streak, hidden, onToggle, hold }: { streak: number; hidden: boolean; onToggle: () => void; hold?: LongPressProps }) {
  const phone = useIsMobile();
  if (phone) return hidden ? null : <PhoneStreakCard streak={streak} hold={hold} />;
  return hidden
    ? <button type="button" className="ct-streak-hide" onClick={onToggle}>Показать серию дней</button>
    : <StreakCard streak={streak} onHide={onToggle} hold={hold} />;
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
