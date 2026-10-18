import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { hueStyle } from '../../lib/tone';
import { FreqMark, FreqHint } from './FreqMark';
import { findSchema, shortName } from './schemasModel';
import { groupMineByDomain } from './mineGroups';

interface Props {
  ids: string[];
  onAdd: () => void;
  onOpenSchema: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
}

/** «Мои схемы» на телефоне: строки по доменам, как в мини-аппе — название, статус карточки, частота. */
export function MySchemasList({ ids, onAdd, onOpenSchema, statusFor, freq }: Props) {
  return (
    <section className="cs-block">
      {freq && <FreqHint kind="schema" freq={freq} />}
      {groupMineByDomain(SCHEMA_DOMAINS, ids).map(g => (
        <div key={g.id} className="cs-grp-wrap" style={hueStyle(g.hue)}>
          <div className="cs-grp-head"><span>{g.title}</span><span>{g.schemaIds.length}</span></div>
          <div className="cs-grp">
            {g.schemaIds.map(id => {
              const found = findSchema(SCHEMA_DOMAINS, id);
              if (!found) return null;
              return (
                <button key={id} className="cs-row" onClick={() => onOpenSchema(id)}>
                  <span className="cs-row-text">
                    <span className="cs-row-name tone-ink">{shortName(found.schema.name)}</span>
                    {statusFor && <span className="cs-row-sub">{statusFor(id)}</span>}
                  </span>
                  {freq && <FreqMark freq={freq[id] ?? 0} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button className="cs-add" onClick={onAdd}>+ Добавить схему</button>
    </section>
  );
}
