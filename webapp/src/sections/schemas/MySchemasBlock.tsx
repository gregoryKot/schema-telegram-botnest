import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { hueStyle, DOMAIN_HUE } from '../../lib/tone';
import { Skeleton } from '../../components/Skeleton';
import { findSchema, shortName } from './schemasModel';

interface Props {
  loading: boolean;
  ids: string[];
  onAdd: () => void; onOpenSchema: (id: string) => void;
  statusFor?: (id: string) => string; // статус карточки словами; undefined — пока грузится
}

/** «Мои схемы»: чипы цвета домена со статусом карточки и добавление вручную. */
export function MySchemasBlock({ loading, ids, onAdd, onOpenSchema, statusFor }: Props) {
  const tr = useTr();
  return (
    <section className="cs-block">
      <div className="ds-head-row">
        <h3 className="ds-h3">Мои схемы</h3>
        <button onClick={onAdd} className="ds-link">+ Добавить</button>
      </div>
      {loading ? (
        <div className="cs-chips">
          {[80, 100, 90, 110].map((w, i) => <Skeleton key={i} height={32} width={w} radius={16} />)}
        </div>
      ) : ids.length === 0 ? (
        <p className="cs-empty">{tr('Пройди тест на схемы или добавь вручную', 'Пройдите тест на схемы или добавьте вручную')}</p>
      ) : (
        <div className="cs-chips">
          {ids.map(id => {
            const found = findSchema(SCHEMA_DOMAINS, id);
            if (!found) return null;
            return (
              <button key={id} className={`cs-chip tone-tint tone-border${statusFor ? ' cs-chip--stacked' : ''}`} style={hueStyle(DOMAIN_HUE[found.domain.id])} onClick={() => onOpenSchema(id)}>
                {shortName(found.schema.name)}{statusFor && <span className="cs-chip-status">{statusFor(id)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
