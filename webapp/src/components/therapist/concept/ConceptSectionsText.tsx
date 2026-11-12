import { useNeedData, NEED_ORDER } from '../../../../../shared/src/needs/needData';
import { needLook, modeGroupLook } from '../../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../../lib/tone';
import { SignChip } from '../../paper/SignChip';
import { SignArt } from '../../art/SignArt';
import { ConceptMark } from '../../../../../shared/src/therapy/conceptGraph/conceptPaper';
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
  { label: 'Капитуляция', sub: 'подчиняется схеме' },
  { label: 'Избегание', sub: 'уходит от активации' },
  { label: 'Гиперкомпенсация', sub: 'действует наоборот' },
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
          const look = needLook(id);
          return <SignChip key={id} label={needs[id].name} on={hasTag(value, needs[id].name)} sign={look.sign} hue={look.hue} onToggle={() => onChange(appendTag(value, needs[id].name))} />;
        })}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} />
    </div>
  );
}

export function ConceptTriggers({ value, onChange, placeholder }: FieldProps) {
  return (
    <div className="tcp-stack">
      <div className="tcp-tags" style={hueStyle(undefined)}>
        {TRIGGER_TAGS.map((t) => <SignChip key={t} label={t} on={hasTag(value, t)} onToggle={() => onChange(appendTag(value, t))} />)}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={3} />
    </div>
  );
}

export function ConceptCoping({ value, onChange, placeholder }: FieldProps) {
  return (
    <div className="tcp-stack">
      <div className="tcp-coping">
        {COPING.map((c) => (
          <div key={c.label} className="pp-paper tcp-cop">
            <b className="ds-list-title">{c.label}</b>
            <span className="ds-sub">{c.sub}</span>
          </div>
        ))}
      </div>
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} />
    </div>
  );
}

// Цепочка — из режимов клиента (modeChain.ts), иначе одно поле; rows 5 — подсказка в 4–5 строк на телефоне (16px).
export function ConceptModes({ value, onChange, placeholder }: FieldProps) {
  const chain = useConceptModeChain();
  return (
    <div className="tcp-stack">
      {chain.length > 0 && (
        <div className="tcp-chain">
          {chain.map((m, i) => (
            <div key={m.modeId} className="tcp-chain-item">
              {i > 0 && <span className="tcp-arrow"><ConceptMark kind="arrow" /></span>}
              <div className="pp-paper tcp-node" style={hueStyle(modeGroupLook(m.group).hue)}>
                <span className="ds-label tcp-node-kind"><SignArt sign={modeGroupLook(m.group).sign} size="nav" />{m.kind}</span>
                <b className="ds-list-title">{m.name}</b>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={5} />
    </div>
  );
}

export function ConceptProblems({ value, onChange, placeholder }: FieldProps) {
  return <ConceptArea value={value} onChange={onChange} placeholder={placeholder} rows={4} />;
}
