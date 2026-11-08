import { DomainArt } from '../../components/art/DomainArt';
import { GuideSignArt } from '../../components/art/GuideSigns';
import type { ReferenceArt, ReferenceGroup, ReferenceItem, ReferenceLayout } from './guideReferenceModel';
import '../../styles/guide-reference.css';

/**
 * Список «Справочника» (styles/guide-reference.css). `groups` — режимы и схемы: знак группы
 * или домена у подписи, строки под ней без знака (у всех строк группы он один); на широком
 * экране группы встают в две колонки. `tiles` — техники и «Для терапевта»: у строки свой знак и
 * суть, на широком экране — карточки в две колонки. `rows` — поиск: строки разных групп
 * вперемешку, у каждой свой знак. Тап по строке открывает её лист.
 */
export function GuideReferenceList({ groups, layout, onOpen }: {
  groups: ReferenceGroup[];
  layout: ReferenceLayout;
  onOpen: (item: ReferenceItem) => void;
}) {
  const rowArt = layout !== 'groups';
  return (
    // Обёртка — контейнер для @container: колонки зависят от ширины списка, а не окна (меню бывает свёрнуто).
    <div className="gr-wrap">
      <div className={`gr-list gr-list--${layout}`}>
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title} className="gr-group">
            {g.title && (
              <div className="gr-group-head">
                {!rowArt && g.art && <span className="pp-row-art"><ReferenceArtView art={g.art} /></span>}
                <h2 className="ds-label" style={{ margin: 0 }}>{g.title}</h2>
              </div>
            )}
            <div className="ds-card ds-card--flush gr-rows">
              {g.items.map((item) => (
                <button
                  key={`${item.kind}:${item.id}`} type="button"
                  className={`ds-list-row ds-list-row--hover ${rowArt ? 'gr-row' : 'ds-list-row--nav'}`} onClick={() => onOpen(item)}
                >
                  {rowArt && <span className="pp-row-art">{item.art && <ReferenceArtView art={item.art} />}</span>}
                  <span className="ds-list-body">
                    <span className="ds-list-title">{item.name}</span>
                    {item.sub && <span className="ds-list-sub">{item.sub}</span>}
                  </span>
                  <span className="ds-chev" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Знак строки или группы в размере строки: знак листа подсказок или домен схем. */
function ReferenceArtView({ art }: { art: ReferenceArt }) {
  return 'sign' in art ? <GuideSignArt sign={art.sign} size="row" /> : <DomainArt domain={art.domain} size="row" />;
}
