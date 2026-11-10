// Выбор схемы и режима для карточки-задания (TaskCreateSheet, b20). Режимы — общий список по группам (ModeGroupList:
// бумага группы и её знак, как в дневнике режимов и «Справочнике»): до b20 здесь шли 36 строк с одним и тем же
// Cluster. Схемы — так же по доменам: бумага домена и DomainArt у подписи группы, строки без знака.
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { hueStyle } from '../../lib/tone';
import { domainLook } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import { GlyphCheck } from '../exercises/ExScreen';
import { ModeGroupList } from '../diary/ModeGroupList';

interface PickerProps { value: string; onPick: (id: string) => void }

export function SchemaPicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какую схему изучить?</div>
      <div className="sk-domains">
        {SCHEMA_DOMAINS.map(d => {
          const look = domainLook(d.id);
          return (
            <section key={d.id} className="pp-paper sk-domain" style={hueStyle(look?.hue)}>
              <h3 className="sk-domain-head">
                {look && <span className="sk-domain-sign" aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>}
                <span className="ds-label">{d.domain}</span>
              </h3>
              <div className="sk-domain-rows">
                {d.schemas.map(s => (
                  <button key={s.id} type="button" aria-pressed={value === s.id}
                    className={'sk-pick' + (value === s.id ? ' is-on' : '')}
                    onClick={() => { haptic.select(); onPick(s.id); }}>
                    <span className="sk-pick-name">{s.name}</span>
                    <span className="sk-pick-check" aria-hidden="true"><GlyphCheck /></span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ModePicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какой режим изучить?</div>
      <ModeGroupList modeId={value} onPick={onPick} />
    </div>
  );
}
