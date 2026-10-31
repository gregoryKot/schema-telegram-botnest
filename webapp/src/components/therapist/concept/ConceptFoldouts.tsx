import { NeedFold } from '../../NeedFold';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptVersionHistory } from './ConceptVersionHistory';
import { YsqCrossCheck } from './YsqCrossCheck';
import { ysqFoldTitle } from './conceptHeadText';

// Сверка с YSQ и история версий под содержанием вкладки, свёрнутые (#879). Раньше
// стояли в правой колонке doc-grid: на ноутбуке она отнимала у схемы ширину
// (четыре колонки — от 960px), а на телефоне правой колонки нет вовсе. Заголовок
// раскрывашки несёт число, чтобы решать «открывать или нет», не открывая.
export function ConceptFoldouts({ detail }: { detail: ClientDetail }) {
  const { ysqSchemaIds, activeSchemaIds, concept, clientData } = detail;
  const missing = ysqSchemaIds.filter(id => !activeSchemaIds.includes(id)).length;
  const versions = concept?.history?.length ?? 0;
  if (ysqSchemaIds.length === 0 && versions === 0) return null;
  return (
    <div className="tcp-folds">
      {ysqSchemaIds.length > 0 && (
        <NeedFold title={ysqFoldTitle(missing)}>
          <YsqCrossCheck ysqActiveIds={ysqSchemaIds} latest={clientData?.ysqHistory?.[0]} conceptSchemaIds={activeSchemaIds} />
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
