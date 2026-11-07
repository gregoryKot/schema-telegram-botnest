import { hintSchemas } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { hueStyle, NEED_HUE } from '../../../lib/tone';
import { Layers } from '../../art/PaperArt';
import { SchemaHintHead } from './SchemaHintHead';
import '../../../styles/sheet-childhood.css';

/**
 * «Возможные активные схемы» по низким потребностям: у каждой – домен и
 * схемы-кнопки (тап открывает описание схемы), внизу – переход в справочник.
 */
export function SchemaHints({
  lowIds,
  ratings,
  onOpenSchema,
  onOpenSchemas,
}: {
  lowIds: NeedId[];
  ratings: Record<string, number>;
  onOpenSchema: (schemaId: string) => void;
  onOpenSchemas?: () => void;
}) {
  return (
    <section className="chw-hints">
      <div className="ds-label">Возможные активные схемы</div>
      <p className="chw-hints-lede">
        Когда потребность хронически не удовлетворялась в детстве, психика вырабатывает стратегии
        выживания. Это и есть схемы – не диагноз, а паттерн, который когда-то помогал.
      </p>
      {lowIds.map((id) => {
        return (
          <div key={id} className="ds-card chw-hint" style={hueStyle(NEED_HUE[id])}>
            <SchemaHintHead id={id} score={ratings[id]} />
            <div className="chw-chips">
              {hintSchemas(id).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="ds-chip tone-tint chw-chip"
                  onClick={() => onOpenSchema(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {onOpenSchemas && (
        <button type="button" className="ds-card ds-card--row ds-card--nav ds-card--hover" onClick={onOpenSchemas}>
          <span className="pp-row-art"><Layers size="row" /></span><span className="ds-list-body"><span className="ds-list-title">Подробнее о схемах</span><span className="ds-list-sub">Что они значат и как с ними работать</span></span>
          <span className="ds-chev" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
