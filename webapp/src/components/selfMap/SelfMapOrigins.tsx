import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { DomainArt } from '../art/DomainArt';
import { SignArt } from '../art/SignArt';
import { schemaDomain } from '../art/guideSignsModel';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { originSub, type OriginsView } from '../../../../shared/src/map/mapOrigins';

/**
 * Полоса «Откуда тянется»: схемы человека строками со знаком домена, тап — карточка схемы.
 * Схем нет — одна честная строка-вход: в тест на схемы или в «Мои паттерны» (mapOrigins.ts).
 */
export function SelfMapOrigins({ view, onPickSchema, onStartTest, onOpenPatterns }: {
  view: OriginsView;
  onPickSchema: (schemaId: string) => void;
  onStartTest: () => void;
  onOpenPatterns: () => void;
}) {
  const tr = useTr();
  const emptyRow = view.empty === 'test'
    ? { title: 'Пройти тест на схемы', sub: tr('116 вопросов, около 10 минут. Покажет, какие схемы стоят за этими частями.', '116 вопросов, около 10 минут. Покажет, какие схемы стоят за этими частями.'), onTap: onStartTest, art: <SignArt sign={ENTITY_LOOK.ysq.sign} size="row" /> }
    : view.empty === 'pick'
      ? { title: 'Отметить свои схемы', sub: tr('Тест не выделил ярких схем. Узнаёшь себя в какой-то — отметь в «Моих паттернах».', 'Тест не выделил ярких схем. Узнаёте себя в какой-то — отметьте в «Моих паттернах».'), onTap: onOpenPatterns, art: <SignArt sign={ENTITY_LOOK.schemas.sign} size="row" /> }
      : null;

  return (
    <section className="sm-lane" aria-label={view.title}>
      <h3 className="ds-label sm-lane-title">{view.title}</h3>
      <div className="ds-rows sm-list">
        {view.items.map((item) => (
          <div key={item.schemaId} className="ds-list-row ds-list-row--nav ds-list-row--hover" {...pressable(() => onPickSchema(item.schemaId))}>
            <span className="pp-row-art" aria-hidden="true"><DomainArt domain={schemaDomain(item.schemaId)} size="row" /></span>
            <div className="ds-list-body">
              <div className="ds-list-title">{item.name}</div>
              <div className="ds-list-sub">{originSub(item)}</div>
            </div>
          </div>
        ))}
        {emptyRow && (
          <div className="ds-list-row ds-list-row--nav ds-list-row--hover" {...pressable(emptyRow.onTap)}>
            <span className="pp-row-art" aria-hidden="true">{emptyRow.art}</span>
            <div className="ds-list-body">
              <div className="ds-list-title">{emptyRow.title}</div>
              <div className="ds-list-sub">{emptyRow.sub}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
