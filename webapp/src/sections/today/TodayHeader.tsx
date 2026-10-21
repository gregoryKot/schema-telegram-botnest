import { useTr } from '../../utils/addressForm';
import { CustomizeGear } from '../../components/customize/CustomizeGear';
import { useIsMobile } from '../../components/useIsMobile';
import { greeting, formatHeaderDate, phoneGreeting } from './helpers';
import { formatGreetingDate } from './greetingDate';

interface Props {
  streak: number;
  firstName: string;
  /** Открыть лист «Настроить экран» */
  onCustomize: () => void;
}

// Шапка «Сегодня». Десктоп: eyebrow с датой и серией + h1, справа ссылка
// «Настроить экран». Телефон (≤767px, client-today.css): eyebrow скрыт, под h1 —
// строка с датой, справа — шестерёнка; обе открывают лист «Настроить экран»
// (как в мини-аппе), общие настройки приложения — строкой внутри листа.
export function TodayHeader({ streak, firstName, onCustomize }: Props) {
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
      {phone ? (
        <CustomizeGear label="Настроить экран" onClick={onCustomize} />
      ) : (
        <button type="button" className="ds-link ct-head-customize" onClick={onCustomize}>
          Настроить экран
        </button>
      )}
    </header>
  );
}
