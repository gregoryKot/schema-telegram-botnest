import { getModeById, getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { useNeedData } from '../../../../shared/src/needs/needData';
import { workFields } from '../../../../shared/src/therapy/sessionWork/fields';
import { workTitle } from '../../../../shared/src/therapy/sessionWork/names';
import { normalizeSessionWork } from '../../../../shared/src/therapy/sessionWork/normalize';
import type { SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';

/** «Что делали» под записью сессии: название, с чем работали, заполненные поля. У записи без пунктов блока нет. */
export function SessionWorkList({ work }: { work: SessionWorkItem[] | undefined }) {
  const needData = useNeedData();
  const items = normalizeSessionWork(work);
  if (items.length === 0) return null;
  return (
    <ul className="sw-list" aria-label="Что делали">
      {items.map(item => {
        // Режим или схема, которых больше нет в справочнике, метки не дают.
        const tags = [
          ...item.modeIds.map(id => getModeById(id)?.name),
          ...item.schemaIds.map(id => getSchemaById(id)?.name),
          ...item.needIds.map(id => needData[id]?.name),
        ].filter((name): name is string => !!name);
        const filled = (workFields(item.kind, item.refId) ?? []).filter(([key]) => item.fields[key]);
        return (
          <li key={item.id} className="sw-done">
            <div className="sw-done-title">{workTitle(item)}</div>
            {tags.length > 0 && (
              <div className="sw-tags">{tags.map(tag => <span key={tag} className="ds-chip ds-chip--sm sw-tag">{tag}</span>)}</div>
            )}
            {filled.map(([key, label]) => (
              <div key={key} className="sw-done-field">
                <div className="tb-meta">{label}</div>
                <div>{item.fields[key]}</div>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
