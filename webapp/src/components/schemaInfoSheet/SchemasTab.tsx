import { useState } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';

// Вкладка «схемы» справочника: домены-аккордеон, внутри плитки схем.
// Вынесено из SchemaInfoSheet.tsx (правило №10).
export function SchemasTab({ highlight }: { highlight?: string }) {
  const initialDomain = highlight
    ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.name === highlight))?.domain ?? null
    : null;
  const [open, setOpen] = useState<string | null>(initialDomain);

  return (
    <div className="ss-pane">
      <p className="ss-body">
        20 ранних дезадаптивных схем сгруппированы в 5 доменов. Схема – не диагноз, а паттерн, который когда-то помогал выжить.
      </p>
      {SCHEMA_DOMAINS.map((d) => {
        const isOpen = open === d.domain;
        const toggle = () => setOpen(isOpen ? null : d.domain);
        return (
          <div key={d.domain} className="ss-domain" style={hueStyle(DOMAIN_HUE[d.id])}>
            <div
              onClick={toggle}
              role="button" tabIndex={0} aria-expanded={isOpen}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
              className="ss-domain-head tone-tint"
            >
              <span className="ds-dot tone-fill" />
              <span className="ss-domain-name">{d.domain}</span>
              <span className="ss-domain-count">{d.schemas.length}</span>
              <svg className={`ss-chev${isOpen ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {isOpen && (
              <div className="ss-tiles">
                {d.schemas.map(s => {
                  const hl = s.name === highlight;
                  return (
                    <div key={s.name} className={`ss-tile ${hl ? 'tone-tint tone-border' : 'tone-soft'}`}>
                      <div className="ss-tile-name tone-ink">{s.name}{hl && ' ◀'}</div>
                      <div className="ss-tile-desc">{(s as { libraryDesc?: string; desc: string }).libraryDesc ?? s.desc}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
