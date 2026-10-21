import type { LongPressProps } from '../../../../shared/src/hooks/useLongPress';
import { useTr } from '../../utils/addressForm';
import { streakDaysLabel } from './streakLabel';

// Серия на телефоне: компактная строка как в мини-аппе — плитка с числом,
// «N дней подряд», подпись без давления. Скрывается в листе «Настроить экран».
export function PhoneStreakCard({ streak, hold }: { streak: number; hold?: LongPressProps }) {
  const tr = useTr();
  return (
    <div {...hold} className="ds-card ct-streak ct-streak--phone">
      <div className={'ct-streak-tile' + (streak > 0 ? '' : ' is-zero')}>{streak}</div>
      <div className="ct-streak-text">
        <div className="ct-streak-label">
          {streak === 0 ? tr('Оцени потребности – начнётся стрик', 'Оцените потребности – начнётся стрик') : streakDaysLabel(streak)}
        </div>
        {streak > 0 && (
          <div className="ct-streak-cap">
            {tr('сбиться — не страшно, просто продолжай', 'сбиться — не страшно, просто продолжайте')}
          </div>
        )}
      </div>
    </div>
  );
}
