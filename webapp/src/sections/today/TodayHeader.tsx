import { useTr } from '../../utils/addressForm';
import { GearIcon } from '../../../../shared/src/components/GearIcon';
import { useIsMobile } from '../../components/useIsMobile';
import { greeting, formatHeaderDate, phoneGreeting } from './helpers';
import { formatGreetingDate } from './greetingDate';

interface Props {
  streak: number;
  firstName: string;
  onOpenSettings: () => void;
}

// Шапка «Сегодня». Десктоп: eyebrow с датой и серией + h1. Телефон (≤767px,
// client-today.css): eyebrow скрыт, под h1 — строка с датой, справа — шестерёнка настроек.
export function TodayHeader({ streak, firstName, onOpenSettings }: Props) {
  const tr = useTr();
  const phone = useIsMobile();
  return (
    <header className="ct-head">
      <div className="ct-head-text">
        <div className="ds-eyebrow ct-head-eyebrow">
          {formatHeaderDate()}
          {streak > 0 ? ` · ${streak}-й день подряд` : ''}
        </div>
        <h1 className="ds-h1">
          {phone ? phoneGreeting(firstName) : (
            <>
              {greeting()}
              {firstName && (
                <>
                  , <i>{firstName}</i>
                </>
              )}
            </>
          )}
        </h1>
        <div className="ct-head-date">
          {formatGreetingDate()} · {tr('твой темп', 'ваш темп')}
        </div>
      </div>
      <button
        type="button"
        className="ct-head-gear"
        aria-label="Настройки"
        onClick={onOpenSettings}
      >
        <GearIcon />
      </button>
    </header>
  );
}
