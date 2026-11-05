import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { countSchemas, domainCountLabel, domainsWord, groupMap, schemasWord } from './schemasModel';

interface Props {
  mineIds: string[];
  onOpenSchema: (id: string) => void;
}

/** «Полная карта»: схемы по доменам; отмеченные пользователем подсвечены. */
export function SchemaMap({ mineIds, onOpenSchema }: Props) {
  const tr = useTr();
  const domains = groupMap(SCHEMA_DOMAINS, mineIds);
  const total = countSchemas(SCHEMA_DOMAINS);
  return (
    <section className="cs-map">
      <div className="ds-head-row">
        <h2 className="ds-h2">Полная карта · {total} {schemasWord(total)}</h2>
        <span className="ds-sub">
          {domains.length} {domainsWord(domains.length)} · {tr('нажми на схему, чтобы открыть описание', 'нажмите на схему, чтобы открыть описание')}
        </span>
      </div>
      {domains.map(d => (
        <div key={d.id} className="cs-domain" style={hueStyle(d.hue)}>
          <div className="cs-domain-head">
            <span className="cs-domain-line tone-fill" />
            <span className="cs-domain-name tone-ink">{d.title}</span>
            <span className="ds-sub">{domainCountLabel(d)}</span>
          </div>
          <div className="cs-tiles">
            {d.schemas.map(s => (
              <button
                key={s.id}
                className={`cs-tile${s.isMine ? ' is-mine tone-tint tone-border' : ''}`}
                onClick={() => onOpenSchema(s.id)}
              >
                <span className="cs-tile-name">{s.name}</span>
                <span className="cs-tile-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
