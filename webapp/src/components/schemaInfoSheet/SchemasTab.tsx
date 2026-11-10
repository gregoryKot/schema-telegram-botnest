import { useEffect, useRef, useState } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DomainMark } from '../DomainMark';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { GlyphChevron } from '../exercises/ExGlyphs';

// Вкладка «схемы» справочника: домены-аккордеон, внутри — белые листы схем на бумаге домена.
// Вынесено из SchemaInfoSheet.tsx (правило №10). Схема, к которой пришли из результата теста
// (highlight), — лист, приподнятый над остальными сплошным слоем бумаги домена (тень-вырезка),
// а не глиф «◀» у названия; при открытии лист подъезжает к ней (один раз — дальше человек листает сам).
export function SchemasTab({ highlight }: { highlight?: string }) {
  const initialDomain = highlight
    ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.name === highlight))?.domain ?? null
    : null;
  const [open, setOpen] = useState<string | null>(initialDomain);
  const hlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { hlRef.current?.scrollIntoView?.({ block: 'center' }); }, []);

  return (
    <div className="ss-pane">
      <p className="ss-body">
        20 ранних дезадаптивных схем сгруппированы в 5 доменов. Схема – не диагноз, а паттерн, который когда-то помогал выжить.
      </p>
      <div className="ss-domains">
        {SCHEMA_DOMAINS.map((d) => {
          const isOpen = open === d.domain;
          const toggle = () => setOpen(isOpen ? null : d.domain);
          return (
            <section key={d.domain} className={`pp-paper ss-domain${isOpen ? ' is-open' : ''}`} style={hueStyle(DOMAIN_HUE[d.id])}>
              <button type="button" onClick={toggle} aria-expanded={isOpen} className="ss-domain-head">
                <DomainMark domainId={d.id} />
                <span className="ss-domain-name">{d.domain}</span>
                <span className="ss-domain-count">{d.schemas.length}</span>
                <span className={`ss-chev${isOpen ? ' is-open' : ''}`} aria-hidden="true"><GlyphChevron /></span>
              </button>
              {isOpen && (
                <div className="ss-tiles">
                  {d.schemas.map(s => {
                    const hl = s.name === highlight;
                    return (
                      <div key={s.name} ref={hl ? hlRef : undefined} className={`ss-tile${hl ? ' is-hl' : ''}`} aria-current={hl || undefined}>
                        <div className="ss-tile-name">{s.name}</div>
                        <div className="ss-tile-desc">{(s as { libraryDesc?: string; desc: string }).libraryDesc ?? s.desc}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
