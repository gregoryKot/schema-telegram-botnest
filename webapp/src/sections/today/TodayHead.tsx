import { homeGreeting } from './helpers';
import { formatGreetingDate } from './greetingDate';

// Шапка «Сегодня»: дата и «Зачем это?» в одной строке, ниже приветствие. На ≥768 — на всю ширину колонки (client-today.css).
export function TodayHead({ firstName, onWhy }: { firstName: string; onWhy: () => void }) {
  return (
    <header className="ct-head">
      <div className="ct-head-top">
        <div className="ds-eyebrow">{formatGreetingDate()}</div>
        <button type="button" className="ct-link ct-head-why" onClick={onWhy}>Зачем это?</button>
      </div>
      <h1 className="ds-h1 ct-h1">{homeGreeting(firstName)}</h1>
    </header>
  );
}
