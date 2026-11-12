import { SignArt } from '../../components/art/SignArt';
import { SignGroup } from '../../components/schemaSheets/SignGroup';
import type { ReferenceGroup, ReferenceItem, ReferenceLayout } from './guideReferenceModel';
import '../../styles/guide-reference.css';

/**
 * Список «Справочника» (styles/guide-reference.css). Группа — лист бумаги своего оттенка (SignGroup,
 * тот же, что у групп справочника клиента): знак группы режимов или домена у подписи один раз, под
 * ним белые строки без знака. У листа без знака (техники, «Для терапевта») знак у каждой строки свой,
 * под названием — суть. `groups` — режимы и схемы: на широком экране листы встают в две колонки;
 * `tiles` — техники и «Для терапевта»: белые карточки по две в ряд на одном листе; `rows` — поиск:
 * листы найденных групп в столбик. Тап по строке открывает её лист подсказок.
 */
export function GuideReferenceList({ groups, layout, onOpen }: {
  groups: ReferenceGroup[];
  layout: ReferenceLayout;
  onOpen: (item: ReferenceItem) => void;
}) {
  return (
    // Обёртка — контейнер для @container: колонки зависят от ширины списка, а не окна (меню бывает свёрнуто).
    <div className="gr-wrap">
      <div className={`gr-list gr-list--${layout}`}>
        {groups.map((g) => {
          const rowArt = !g.look.sign;
          return (
            <SignGroup key={g.key} look={g.look} title={g.title} label={g.title} headAs="h2" rowsClassName="gr-rows">
              {g.items.map((item) => (
                <button
                  key={`${item.kind}:${item.id}`} type="button"
                  className={`ds-list-row ds-list-row--hover ${rowArt ? 'gr-row' : 'ds-list-row--nav'}`} onClick={() => onOpen(item)}
                >
                  {rowArt && <span className="pp-row-art">{item.sign && <SignArt sign={item.sign} size="row" />}</span>}
                  <span className="ds-list-body">
                    <span className="ds-list-title">{item.name}</span>
                    {item.sub && <span className="ds-list-sub">{item.sub}</span>}
                  </span>
                  <span className="ds-chev" aria-hidden="true" />
                </button>
              ))}
            </SignGroup>
          );
        })}
      </div>
    </div>
  );
}
