import { useState } from 'react';
import type { ClientDetail } from './clientSheetTypes';
import { newWorkItem, type WorkOption } from '../../../../shared/src/therapy/sessionWork/names';
import { WORK_ITEMS_MAX, type SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
import { SessionWorkItemCard } from './SessionWorkItemCard';
import { SessionWorkPicker } from './SessionWorkPickerSheet';
import type { NamedMode } from './useCustomModeNames';

type Detail = Pick<ClientDetail, 'newNoteWork' | 'setNewNoteWork' | 'activeModeIds' | 'activeSchemaIds' | 'ysqSchemaIds' | 'selfSchemaIds'>;

/** «Что делали» в форме итогов сессии (#1330): пункты записи и выбор вида нового пункта. Клиенту не видно. */
export function SessionWorkBlock({ detail, customModes }: { detail: Detail; customModes?: NamedMode[] }) {
  const { newNoteWork: work, setNewNoteWork: setWork } = detail;
  const [picking, setPicking] = useState(false);
  const add = (option: WorkOption) => { setWork([...work, newWorkItem(option)]); setPicking(false); };
  const change = (item: SessionWorkItem) => setWork(work.map(w => (w.id === item.id ? item : w)));
  // Схемы клиента: из концептуализации, теста и отмеченные им самим.
  const clientSchemaIds = [...detail.activeSchemaIds, ...detail.ysqSchemaIds, ...detail.selfSchemaIds];
  return (
    <section className="sw-block" aria-label="Что делали">
      {work.length > 0 && <div className="ds-label">Что делали</div>}
      {work.map(item => (
        <SessionWorkItemCard
          key={item.id} item={item} onChange={change}
          onRemove={() => setWork(work.filter(w => w.id !== item.id))}
          clientModeIds={detail.activeModeIds} clientSchemaIds={clientSchemaIds} customModes={customModes}
        />
      ))}
      {picking
        ? <SessionWorkPicker onPick={add} onClose={() => setPicking(false)} />
        : work.length < WORK_ITEMS_MAX && (
        <button type="button" className="sw-add" onClick={() => setPicking(true)}>
          {work.length === 0 ? 'Что делали на сессии — добавить' : 'Добавить ещё'}
        </button>
      )}
    </section>
  );
}
