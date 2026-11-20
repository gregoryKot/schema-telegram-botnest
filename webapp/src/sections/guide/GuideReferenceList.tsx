import type { CSSProperties } from 'react';
import { SignArt } from '../../components/art/SignArt';
import { SignGroup, SignGroupHead } from '../../components/schemaSheets/SignGroup';
import type { ReferenceGroup, ReferenceItem, ReferenceLayout } from './guideReferenceModel';
import '../../styles/guide-reference.css';

type Open = (item: ReferenceItem) => void;
/** Строки группы: со знаком листа — без знака у строки; у листа без знака знак у каждой строки свой, под названием — суть. */
const rows = (g: Pick<ReferenceGroup, 'look' | 'items'>, onOpen: Open) => g.items.map((item) => (
  <button
    key={`${item.kind}:${item.id}`} type="button"
    className={`ds-list-row ds-list-row--hover ${g.look.sign ? 'ds-list-row--nav' : 'gr-row'}`} onClick={() => onOpen(item)}
  >
    {!g.look.sign && <span className="pp-row-art">{item.sign && <SignArt sign={item.sign} size="row" />}</span>}
    <span className="ds-list-body">
      <span className="ds-list-title">{item.name}</span>
      {item.sub && <span className="ds-list-sub">{item.sub}</span>}
    </span>
    <span className="ds-chev" aria-hidden="true" />
  </button>
));
/** Список «Справочника» (guide-reference.css): лист группы — SignGroup; лист с подгруппами (`parts`, три копинга) — без общей
 *  шапки, у подгруппы своя. `groups` — листы колонками, `tiles` — белые карточки, `rows` — поиск столбиком. */
export function GuideReferenceList({ groups, layout, onOpen }: { groups: ReferenceGroup[]; layout: ReferenceLayout; onOpen: Open }) {
  const short = groups.filter((g) => !g.parts).length; // листы без подгрупп: столько рядов рядом с высоким листом
  return (
    <div className="gr-wrap">{/* контейнер для @container: колонки зависят от ширины списка, а не окна */}
      <div className={`gr-list gr-list--${layout}${short < groups.length ? ' has-tall' : ''}`} style={{ '--gr-rows': Math.max(1, short) } as CSSProperties}>
        {groups.map((g) => g.parts ? (
          <SignGroup key={g.key} look={g.look} rowsClassName="gr-parts">
            {g.parts.map((p) => (
              <section key={p.key} className="gr-part" aria-label={p.title}>
                <SignGroupHead signs={p.look.sign ? [p.look.sign] : []} title={p.title} as="h2" className="gr-part-head" />
                <div className="sg-rows gr-rows">{rows(p, onOpen)}</div>
              </section>
            ))}
          </SignGroup>
        ) : (
          <SignGroup key={g.key} look={g.look} title={g.title} hint={g.hint} fold={g.fold} label={g.title} headAs="h2" rowsClassName="gr-rows">{rows(g, onOpen)}</SignGroup>
        ))}
      </div>
    </div>
  );
}
