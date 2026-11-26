import type { ModeMapNode } from '../../api';
import { SCHEMA_DOMAINS, getSchemaById } from '../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { MMIcon } from '../modeMapIcons';
import { useModeMapConcept, useSchemasOnCanvas } from './clientConceptContext';
import { linkedSchemaIds, ownSchemaIds } from './nodeSchemaIds';

type Data = ModeMapNode['data'];

/** Варианты выбора схемы по доменам; `exclude` — уже выбранные (пустой домен не показывается). */
export function SchemaOptions({ exclude }: { exclude?: ReadonlySet<string> }) {
  return (
    <>
      {SCHEMA_DOMAINS.map(d => {
        const left = d.schemas.filter(s => !exclude?.has(s.id));
        return left.length === 0 ? null : (
          <optgroup key={d.id} label={d.domain}>
            {left.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        );
      })}
    </>
  );
}

const FROM_CONCEPT = 'Связь из концептуализации клиента: убрать её можно во вкладке «Концептуализация», вид «Схема»';

/**
 * «Схемы режима»: таблетки под названием фигуры. Свои — добавляются и убираются
 * здесь; из концептуализации — видны, но правятся в самой концептуализации.
 * Связь режима из справочника со схемой дописывается в поля (conceptSync), как
 * линия между фигурами схемы и режима.
 */
export function ModeSchemasField({ data, patchData }: { data: Data; patchData: (d: Partial<Data>) => void }) {
  const own = ownSchemaIds(data);
  const linked = linkedSchemaIds(useModeMapConcept(), data.modeId, useSchemasOnCanvas()).filter(id => !own.includes(id));
  // Старая одиночная schemaId складывается в список при первой правке.
  const setOwn = (ids: string[]) => patchData({ schemaIds: ids.length ? ids : undefined, schemaId: undefined });
  const chip = (id: string, s = getSchemaById(id)!) => <><i className="mm2-chip-dot" style={hueStyle(DOMAIN_HUE[s.domainId])} /><span>{s.name}</span></>; // домен — тихой точкой его тона
  return (
    <>
      <label className="ds-label" htmlFor="mm-node-schemas">Схемы режима</label>
      {own.length + linked.length > 0 && (
        <div className="mm2-chips mm2-dot-chips">
          {own.map(id => (
            <button key={id} onClick={() => setOwn(own.filter(x => x !== id))}
              aria-label={`Убрать схему «${getSchemaById(id)?.name}»`} title="Убрать с фигуры" className="mm2-chip is-sm">
              {chip(id)}<MMIcon name="close" size={10} className="mm2-chip-x" />
            </button>
          ))}
          {linked.map(id => <span key={id} title={FROM_CONCEPT} className="mm2-chip is-sm is-locked">{chip(id)}</span>)}
        </div>
      )}
      <select id="mm-node-schemas" className="ds-input" value=""
        onChange={e => { if (e.target.value) setOwn([...own, e.target.value]); }}>
        <option value="">+ Добавить схему</option>
        <SchemaOptions exclude={new Set([...own, ...linked])} />
      </select>
    </>
  );
}
