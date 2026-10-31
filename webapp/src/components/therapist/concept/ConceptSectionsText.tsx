import { useNeedData, NEED_ORDER } from '../../../../../shared/src/needs/needData';
import { NEED_HUE, MODE_GROUP_HUE, hueStyle } from '../../../lib/tone';
import { appendTag, hasTag } from './conceptSections';
import type { FieldProps } from './ConceptSectionShell';
import { ConceptArea } from '../ClientConceptFields';
import { useConceptModeChain } from './modeChain';

const PERIODS = [
  { age: '0–6 лет', label: 'раннее детство' },
  { age: '7–12 лет', label: 'школьные годы' },
  { age: '13–18 лет', label: 'юность' },
];

const TRIGGER_TAGS = ['Критика', 'Отдаление близких', 'Неопределённость', 'Контроль', 'Несправедливость', 'Оценка на работе'];

const COPING = [
  { label: 'Капитуляция', sub: 'подчиняется схеме', icon: '↓', hue: 70 },
  { label: 'Избегание', sub: 'уходит от активации', icon: '←', hue: 240 },
  { label: 'Гиперкомпенсация', sub: 'действует наоборот', icon: '↑', hue: 28 },
];

export function ConceptEarly({ value, onChange, placeholder }: FieldProps) {
  return (
    <div>
      <div className="tcp-timeline" aria-hidden="true">
        {PERIODS.map((p) => (
          <div key={p.age} className="tcp-period">
            <i className="tcp-ring" />
            <b>{p.age}</b>
            <span>{p.label}</span>
          </div>
        ))}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={5} />
    </div>
  );
}

export function ConceptNeeds({ value, onChange, placeholder }: FieldProps) {
  const needs = useNeedData();
  return (
    <div className="tcp-stack">
      <div className="tcp-needs">
        {NEED_ORDER.map((id) => {
          const on = hasTag(value, needs[id].name);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              className={`tcp-need tone-tint${on ? ' is-on tone-border' : ''}`}
              style={hueStyle(NEED_HUE[id])}
              onClick={() => onChange(appendTag(value, needs[id].name))}
            >
              <span className="ds-dot tone-fill" />
              <b>{needs[id].name}</b>
            </button>
          );
        })}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} />
    </div>
  );
}

export function ConceptTriggers({ value, onChange, placeholder }: FieldProps) {
  return (
    <div className="ds-card tcp-trig">
      <div className="tcp-tags">
        {TRIGGER_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={hasTag(value, t)}
            className={`tcp-tag${hasTag(value, t) ? ' is-on' : ''}`}
            onClick={() => onChange(appendTag(value, t))}
          >
            {t}
          </button>
        ))}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={3} className="tcp-bare" />
    </div>
  );
}

export function ConceptCoping({ value, onChange, placeholder }: FieldProps) {
  return (
    <div className="tcp-stack">
      <div className="tcp-coping">
        {COPING.map((c) => (
          <div key={c.label} className="tcp-cop tone-soft" style={hueStyle(c.hue)}>
            <span className="tcp-cop-ic tone-fill">{c.icon}</span>
            <div>
              <b>{c.label}</b>
              <span>{c.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} />
    </div>
  );
}

// Цепочка — из режимов клиента (modeChain.ts); не из чего строить — её нет, остаётся поле.
export function ConceptModes({ value, onChange, placeholder }: FieldProps) {
  const chain = useConceptModeChain();
  return (
    <div className="ds-card ds-card--ink tcp-ink">
      {chain.length > 0 && (
        <div className="tcp-chain">
          {chain.map((m, i) => (
            <div key={m.modeId} className="tcp-chain-item">
              {i > 0 && <span className="tcp-arrow" aria-hidden="true">→</span>}
              <div className="tcp-node" style={hueStyle(MODE_GROUP_HUE[m.group])}>
                <span>{m.kind}</span>
                <b>{m.name}</b>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={3} className="tcp-dark" />
    </div>
  );
}

export function ConceptProblems({ value, onChange, placeholder }: FieldProps) {
  return (
    <div className="ds-card tcp-quote">
      <span className="tcp-quote-mark" aria-hidden="true">“</span>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} className="tcp-quote-ta" />
    </div>
  );
}
