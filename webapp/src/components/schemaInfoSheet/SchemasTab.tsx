import { useState } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { ENTITY_LOOK, domainLook } from '../../../../shared/src/theme/entityLook';
import { MapFold } from '../schemaSheets/MapFold';
import { schemasWord } from '../../sections/schemas/schemasModel';

// Вкладка «схемы» справочника: домены — те же аккордеоны MapFold, что «Полная карта» на «Паттернах»
// (одна механика, ревью g5 r1): бумага и знак домена, внутри — белые плитки с описанием, без тапа. Открыт
// один домен. Схема, к которой пришли из результата теста (highlight — имя схемы), — плитка, приподнятая
// над остальными сплошным слоем бумаги домена, а не глиф «◀»; при открытии подъезжает к ней один раз.
export function SchemasTab({ highlight }: { highlight?: string }) {
  const hl = highlight ? SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.name === highlight) : undefined;
  const [open, setOpen] = useState<string | null>(hl ? SCHEMA_DOMAINS.find(d => d.schemas.includes(hl))?.id ?? null : null);

  return (
    <div className="ss-pane">
      <p className="ss-body">
        20 ранних дезадаптивных схем сгруппированы в 5 доменов. Схема – не диагноз, а паттерн, который когда-то помогал выжить.
      </p>
      <div className="cs-mapfolds">
        {SCHEMA_DOMAINS.map((d) => (
          <MapFold
            key={d.id} look={domainLook(d.id) ?? ENTITY_LOOK.schemas} title={d.domain}
            meta={`${d.schemas.length} ${schemasWord(d.schemas.length)}`} highlightId={hl?.id}
            tiles={d.schemas.map(s => ({ id: s.id, name: s.name, desc: s.libraryDesc ?? s.desc }))}
            open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)}
          />
        ))}
      </div>
    </div>
  );
}
