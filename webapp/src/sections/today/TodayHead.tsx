import { homeGreeting } from './helpers';
import { formatGreetingDate } from './greetingDate';
import { FindButton } from '../../components/FindButton';
import { SignArt } from '../../components/art/SignArt';
import { hitboxStyle } from '../../../../shared/src/utils/hitbox';

const MAP_HIT = hitboxStyle(30, 20);

interface Props { firstName: string; onWhy: () => void; onSearch?: () => void; onMap?: () => void; mapNew?: boolean }

// Шапка «Сегодня»: дата, «Зачем это?», знак «Карты себя» (Cluster, как строка на «Ещё»; точка — на карте
// новое) и лупа поиска (только телефон) в одной строке, ниже приветствие. На ≥768 — на всю ширину колонки.
export const TodayHead = ({ firstName, onWhy, onSearch, onMap, mapNew }: Props) => (
  <header className="ct-head">
    <div className="ct-head-top">
      <div className="ds-eyebrow">{formatGreetingDate()}</div>
      <button type="button" className="ct-link ct-head-why" onClick={onWhy}>Зачем это?</button>
      {onMap && (
        <button type="button" className="ct-head-map" style={MAP_HIT.outer} onClick={onMap} title="Карта себя"
          aria-label={mapNew ? 'Карта себя: есть новое' : 'Карта себя'}>
          <span className="ct-head-map-art" style={MAP_HIT.inner}>
            <SignArt sign="cluster" size="nav" />
            {mapNew && <span className="ct-head-map-dot" aria-hidden="true" />}
          </span>
        </button>
      )}
      {onSearch && <FindButton className="search-find" label="Поиск" onClick={onSearch} />}
    </div>
    <h1 className="ds-h1 ct-h1">{homeGreeting(firstName)}</h1>
  </header>
);
