import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { NeedFold } from '../../NeedFold';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptVersionHistory } from './ConceptVersionHistory';
import { ysqFoldTitle } from './conceptHeadText';

// Сверка с YSQ и история версий под содержанием вкладки, свёрнутые (#879). Раньше
// стояли в правой колонке doc-grid: на ноутбуке она отнимала у схемы ширину
// (четыре колонки — от 960px), а на телефоне правой колонки нет вовсе. Заголовок
// раскрывашки несёт число, чтобы решать «открывать или нет», не открывая.
export function ConceptFoldouts({ detail }: { detail: ClientDetail }) {
  const { ysqSchemaIds, activeSchemaIds, concept } = detail;
  const missing = ysqSchemaIds.filter(id => !activeSchemaIds.includes(id)).length;
  const versions = concept?.history?.length ?? 0;
  if (ysqSchemaIds.length === 0 && versions === 0) return null;
  return (
    <div className="tcp-folds">
      {ysqSchemaIds.length > 0 && (
        <NeedFold title={ysqFoldTitle(missing)}>
          <div className="u-col8" style={{ marginTop: 12 }}>
            {ysqSchemaIds.slice(0, 6).map(id => {
              const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
              const inConcept = activeSchemaIds.includes(id);
              return (
                <div key={id} className="u-ac8">
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s?.name ?? id}</span>
                  {!inConcept && <span style={{ fontSize: 11, color: 'var(--c-amber)', fontWeight: 500 }}>+ добавить?</span>}
                </div>
              );
            })}
          </div>
        </NeedFold>
      )}
      {versions > 0 && (
        <NeedFold title={`История версий · ${versions}`}>
          <div style={{ marginTop: 12 }}>
            <ConceptVersionHistory detail={detail} />
          </div>
        </NeedFold>
      )}
    </div>
  );
}
