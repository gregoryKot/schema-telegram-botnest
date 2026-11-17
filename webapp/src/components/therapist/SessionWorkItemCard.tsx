import { useState, type ReactNode } from 'react';
import { MMIcon } from '../modeMapIcons';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { ConceptModePicker } from '../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { ConceptSchemaPicker } from '../../../../shared/src/therapy/conceptGraph/ConceptSchemaPicker';
import { ConceptNeedField } from '../../../../shared/src/therapy/conceptGraph/ConceptNeedField';
import { getModeById, getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { workFields } from '../../../../shared/src/therapy/sessionWork/fields';
import { workTitle } from '../../../../shared/src/therapy/sessionWork/names';
import { WORK_CUSTOM_NAME_MAX, WORK_IDS_MAX, WORK_VALUE_MAX, type SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
import { ConceptPaperProvider } from './concept/ConceptPaperProvider';

interface Props {
  item: SessionWorkItem;
  onChange: (item: SessionWorkItem) => void;
  onRemove: () => void;
  /** Режимы и схемы клиента (концептуализация, тест) — в выборе стоят первыми, остальные под «Все». */
  clientModeIds: string[];
  clientSchemaIds: string[];
}

const toggled = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter(x => x !== id) : ids.length < WORK_IDS_MAX ? [...ids, id] : ids;

/** Раскрываемый выбор: в покое — выбранное строкой, внутри — сначала свои у клиента, «Все» открывает полный список. */
function PickSection({ title, names, own, children }: { title: string; names: string[]; own: boolean; children: (all: boolean) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(!own);
  return (
    <div className="sw-pick">
      <button type="button" className="sw-pick-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="tb-meta">{names.length > 0 ? names.join(', ') : 'не выбраны'}</span>
      </button>
      {open && children(all)}
      {open && own && (
        <button type="button" className="sw-pick-all" onClick={() => setAll(!all)}>{all ? 'Только у клиента' : 'Все'}</button>
      )}
    </div>
  );
}

/** Один пункт «Что делали»: с чем работали (режимы, схемы, потребности) и поля вида; все необязательные. */
export function SessionWorkItemCard({ item, onChange, onRemove, clientModeIds, clientSchemaIds }: Props) {
  const title = workTitle(item);
  const toggle = (key: 'modeIds' | 'schemaIds', id: string) => onChange({ ...item, [key]: toggled(item[key], id) });
  // Выбранное остаётся на виду и в коротком списке: иначе его не снять, не открыв «Все».
  const only = (all: boolean, ids: string[], picked: string[]) => (all ? undefined : new Set([...ids, ...picked]));
  const nameOf = (ids: string[], find: (id: string) => { name: string } | undefined) => ids.flatMap(id => find(id)?.name ?? []);
  return (
    <div className="sw-item" role="group" aria-label={title}>
      <div className="sw-item-head">
        <span className="ds-h3">{item.kind === 'custom' ? 'Своё' : title}</span>
        <button type="button" aria-label={`Убрать пункт «${title}»`} className="ds-btn ds-btn--icon tb-del" onClick={onRemove}><MMIcon name="trash" size={16} /></button>
      </div>
      {item.kind === 'custom' && (
        <input
          className="ds-input" aria-label="Название" placeholder="Название" maxLength={WORK_CUSTOM_NAME_MAX}
          value={item.customName ?? ''} onChange={e => onChange({ ...item, customName: e.target.value })}
        />
      )}
      <ConceptPaperProvider>
        <div className="sw-with" role="group" aria-label="С чем работали">
          <div className="ds-label">С чем работали</div>
          <PickSection title="Режимы" names={nameOf(item.modeIds, getModeById)} own={clientModeIds.length > 0}>
            {all => <ConceptModePicker activeModeIds={item.modeIds} onToggle={id => toggle('modeIds', id)} onlyIds={only(all, clientModeIds, item.modeIds)} />}
          </PickSection>
          <PickSection title="Схемы" names={nameOf(item.schemaIds, getSchemaById)} own={clientSchemaIds.length > 0}>
            {all => <ConceptSchemaPicker activeIds={item.schemaIds} onToggle={id => toggle('schemaIds', id)} onlyIds={only(all, clientSchemaIds, item.schemaIds)} />}
          </PickSection>
          <ConceptNeedField label="Потребности" needIds={item.needIds} onChange={needIds => onChange({ ...item, needIds })} />
        </div>
      </ConceptPaperProvider>
      {(workFields(item.kind, item.refId) ?? []).map(([key, label]) => (
        <label key={key} className="sw-field">
          <span className="tb-meta">{label}</span>
          <LimitedTextarea
            max={WORK_VALUE_MAX} className="ds-textarea" rows={2} value={item.fields[key] ?? ''}
            onChange={e => onChange({ ...item, fields: { ...item.fields, [key]: e.target.value } })}
          />
        </label>
      ))}
    </div>
  );
}
