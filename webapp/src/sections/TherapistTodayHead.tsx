import { Talk } from '../components/art/PaperArtSigns';
import { homeGreeting } from './today/helpers';
import { formatGreetingDate } from './today/greetingDate';

/** Приветствие и дата — те же, что у клиентского «Сегодня» (одна механика); Talk — работа с людьми. */
export function TherapistTodayHead({ displayName }: { displayName: string | null }) {
  return (
    <div className="pp-block pp-block--head">
      <div className="pp-hero">
        <div className="pp-hero-body">
          <div className="ds-label">{formatGreetingDate()}</div>
          <h1 className="pp-hero-title">{homeGreeting(displayName ?? '')}</h1>
        </div>
        <Talk size="hero" />
      </div>
    </div>
  );
}
