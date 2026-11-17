import { useState } from 'react';
import type { ClientDetail } from './clientSheetTypes';
import { WORK_OPTION_GROUPS, newWorkItem, type WorkOption } from '../../../../shared/src/therapy/sessionWork/names';
import { WORK_ITEMS_MAX, type SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
import { SessionWorkItemCard } from './SessionWorkItemCard';

type Detail = Pick<ClientDetail, 'newNoteWork' | 'setNewNoteWork' | 'activeModeIds' | 'activeSchemaIds' | 'ysqSchemaIds' | 'selfSchemaIds'>;

/** «Что делали» в форме итогов сессии (#1330): пункты записи и выбор вида нового пункта. Клиенту не видно. */
export function SessionWorkBlock({ detail }: { detail: Detail }) {
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
          clientModeIds={detail.activeModeIds} clientSchemaIds={clientSchemaIds}
        />
      ))}
      {picking ? (
        <div className="sw-picker" role="group" aria-label="Что делали: выбор">
          {WORK_OPTION_GROUPS.map(group => (
            <div key={group.title} role="group" aria-label={group.title}>
              <div className="tb-meta">{group.title}</div>
              <div className="sw-chips">
                {group.options.map(o => (
                  <button key={o.refId ?? o.kind} type="button" className="ds-chip ds-chip--toggle sw-opt" onClick={() => add(o)}>{o.name}</button>
                ))}
              </div>
            </div>
          ))}
          <div><button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setPicking(false)}>Отмена</button></div>
        </div>
      ) : work.length < WORK_ITEMS_MAX && (
        <button type="button" className="sw-add" onClick={() => setPicking(true)}>
          {work.length === 0 ? 'Что делали на сессии — добавить' : 'Добавить ещё'}
        </button>
      )}
    </section>
  );
}
