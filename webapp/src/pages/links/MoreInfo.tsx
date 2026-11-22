// «?» у названия пункта: тап раскрывает под названием короткий абзац (и цитаты), повторный — закрывает.
// Механика — общая Disclosure (№3, keepMounted даёт aria-controls). Корень — display: contents, поэтому кнопка встаёт рядом с
// названием, а абзац — строкой ниже в той же шапке (.lk-head).
import { Disclosure, type DisclosureClasses } from '../../../../shared/src/components/Disclosure';
import type { LinkMore } from './linksModel';

const MORE: DisclosureClasses = { root: 'lk-more', btn: 'lk-q', label: 'lk-vh', chev: 'lk-q-dot', body: 'lk-more-body' };

export function MoreInfo({ more }: { more: LinkMore }) {
  return (
    <Disclosure classes={MORE} title={`Подробнее о ${more.about}`} chev="?" keepMounted>
      <div className="lk-more-in">
        <p>{more.text}</p>
        {more.quotes && (
          <ul className="lk-quotes">{more.quotes.map((q) => <li key={q}>«{q}»</li>)}</ul>
        )}
      </div>
    </Disclosure>
  );
}
