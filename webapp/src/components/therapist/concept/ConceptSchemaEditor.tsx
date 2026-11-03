import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../../lib/tone';

// Полный выбор актуальных схем: чипы всех 20 по доменам; выбранные — tint и рамка цвета домена (--h на обёртке).
export function ConceptSchemaEditor({ activeIds, onToggle }: { activeIds: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="tcp-pickers">
      {SCHEMA_DOMAINS.map((domain) => (
        <div key={domain.id} style={hueStyle(DOMAIN_HUE[domain.id])}>
          <div className="ds-label tcp-domain">
            <span className="ds-dot tone-fill" />
            {domain.domain}
          </div>
          <div className="tcp-chips">
            {domain.schemas.map((s) => {
              const on = activeIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(s.id)}
                  className={`ds-chip ds-chip--toggle${on ? ' is-on' : ''}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
