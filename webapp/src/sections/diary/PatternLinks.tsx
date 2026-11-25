// Ссылки раскрытой записи на карточки её схем или режима (patternLinksModel): тихие строки над действиями.
import type { PatternTarget } from '../schemas/patternRoute';
import type { PatternLink } from './patternLinksModel';

export function PatternLinks({ links, onOpen }: { links: PatternLink[]; onOpen?: (t: PatternTarget) => void }) {
  if (!onOpen || links.length === 0) return null;
  return (
    <div className="cd-entry-links">
      {links.map(({ kind, id, name }) => (
        <button key={kind + id} type="button" className="ds-link cd-entry-link" onClick={() => onOpen({ kind, id })}>
          {kind === 'mode' ? 'Карточка режима' : 'Карточка схемы'} «{name}»
        </button>
      ))}
    </div>
  );
}
