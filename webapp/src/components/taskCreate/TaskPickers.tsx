import { SCHEMA_DOMAINS, ALL_MODES } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';
import { DOMAIN_HUE, MODE_GROUP_HUE, hueStyle } from '../../lib/tone';

const ALL_SCHEMAS_FLAT = SCHEMA_DOMAINS.flatMap(d => d.schemas.map(s => ({ id: s.id, name: s.name, domainId: d.id })));

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="2,7 5.5,10.5 12,3.5" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PickerProps { value: string; onPick: (id: string) => void }

export function SchemaPicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какую схему изучить?</div>
      <div className="ds-card ds-card--flush">
        {ALL_SCHEMAS_FLAT.map(s => (
          <div key={s.id} className="ds-list-row ds-list-row--hover sk-pick" {...pressable(() => onPick(s.id))}>
            <span className="sk-pick-name">
              <span className="ds-dot tone-fill" style={hueStyle(DOMAIN_HUE[s.domainId])} />
              <span className={value === s.id ? 'sk-strong' : undefined}>{s.name}</span>
            </span>
            {value === s.id && <Check />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModePicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какой режим изучить?</div>
      <div className="ds-card ds-card--flush">
        {ALL_MODES.map(m => (
          <div key={m.id} className="ds-list-row ds-list-row--hover sk-pick" {...pressable(() => onPick(m.id))}>
            <span className="sk-pick-name">
              <span className="ds-dot tone-fill" style={hueStyle(MODE_GROUP_HUE[m.groupId])} />
              <span className={value === m.id ? 'sk-strong' : undefined}>{m.name}</span>
            </span>
            {value === m.id && <Check />}
          </div>
        ))}
      </div>
    </div>
  );
}
