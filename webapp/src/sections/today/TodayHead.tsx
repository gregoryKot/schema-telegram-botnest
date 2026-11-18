import { homeGreeting } from './helpers';
import { formatGreetingDate } from './greetingDate';
import { FindButton } from '../../components/FindButton';

// Шапка «Сегодня»: дата, «Зачем это?» и лупа поиска (только телефон) в одной строке, ниже приветствие. На ≥768 — на всю ширину колонки (client-today.css).
export const TodayHead = ({ firstName, onWhy, onSearch }: { firstName: string; onWhy: () => void; onSearch?: () => void }) => (
  <header className="ct-head">
    <div className="ct-head-top">
      <div className="ds-eyebrow">{formatGreetingDate()}</div>
      <button type="button" className="ct-link ct-head-why" onClick={onWhy}>Зачем это?</button>
      {onSearch && <FindButton className="search-find" label="Поиск" onClick={onSearch} />}
    </div>
    <h1 className="ds-h1 ct-h1">{homeGreeting(firstName)}</h1>
  </header>
);
