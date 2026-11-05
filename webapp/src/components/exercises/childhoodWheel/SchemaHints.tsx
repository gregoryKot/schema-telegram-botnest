import {
  CHILDHOOD_SCHEMA_HINTS,
  hintSchemas,
} from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { hueStyle, NEED_HUE } from '../../../lib/tone';
import { NEEDS } from './needs';
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
        const label = NEEDS.find((n) => n.id === id)?.label ?? id;
        return (
          <div key={id} className="ds-card chw-hint" style={hueStyle(NEED_HUE[id])}>
            <div className="chw-hint-head">
              <span className="ds-dot tone-fill" />
              <span className="chw-hint-name">{label}</span>
              <span className="chw-hint-score">{ratings[id]}/10 в детстве</span>
            </div>
            <div className="chw-hint-domain">Домен: {CHILDHOOD_SCHEMA_HINTS[id].domain}</div>
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
          <span className="ds-list-body"><span className="ds-list-title">Подробнее о схемах</span><span className="ds-list-sub">Что они значат и как с ними работать</span></span>
          <span className="ds-chev" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
