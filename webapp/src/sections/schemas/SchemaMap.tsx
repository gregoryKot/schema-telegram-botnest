import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK, domainLook } from '../../../../shared/src/theme/entityLook';
import { MapFold } from '../../components/schemaSheets/MapFold';
import { countSchemas, domainCountLabel, domainsWord, groupMap, schemasWord } from './schemasModel';

interface Props {
  mineIds: string[];
  onOpenSchema: (id: string) => void;
}

/** «Полная карта»: схемы по доменам — аккордеоны на бумаге домена со знаком; отмеченные — с галочкой. */
export function SchemaMap({ mineIds, onOpenSchema }: Props) {
  const tr = useTr();
  const domains = groupMap(SCHEMA_DOMAINS, mineIds);
  const total = countSchemas(SCHEMA_DOMAINS);
  return (
    <section className="cs-map">
      <div className="ds-head-row">
        <h2 className="ds-h2">Полная карта · {total} {schemasWord(total)}</h2>
        <span className="ds-sub">
          {domains.length} {domainsWord(domains.length)} · {tr('нажми на схему, чтобы открыть описание', 'нажмите на схему, чтобы открыть описание')}
        </span>
      </div>
      <div className="cs-mapfolds">
        {domains.map(d => (
          <MapFold key={d.id} look={domainLook(d.id) ?? ENTITY_LOOK.schemas} title={d.title} meta={domainCountLabel(d)} tiles={d.schemas} onOpen={onOpenSchema} />
        ))}
      </div>
    </section>
  );
}
