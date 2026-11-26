import { homeGreeting } from './today/helpers';
import { formatGreetingDate } from './today/greetingDate';

/** Приветствие и дата — те же, что у клиентского «Сегодня» (одна механика). Знака у шапки нет (b29):
 *  Talk уже стоит у счётчика сессий и у листа «Сессии сегодня» — третий повтор его обесценивал. */
export function TherapistTodayHead({ displayName }: { displayName: string | null }) {
  return (
    <div className="pp-block pp-block--head">
      <div className="pp-hero-body">
        <div className="ds-label">{formatGreetingDate()}</div>
        <h1 className="pp-hero-title">{homeGreeting(displayName ?? '')}</h1>
      </div>
    </div>
  );
}
