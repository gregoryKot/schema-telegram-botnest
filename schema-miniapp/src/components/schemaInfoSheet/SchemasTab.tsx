import { useState } from 'react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { hexToRgbStr } from './helpers';

export function SchemasTab({ highlight }: { highlight?: string }) {
  const initialDomain = highlight
    ? (SCHEMA_DOMAINS.find((d) => d.schemas.some((s) => s.name === highlight))
        ?.domain ?? null)
    : null;
  const [open, setOpen] = useState<string | null>(initialDomain);

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        20 ранних дезадаптивных схем (Young et al., 2003; расширено в 2022)
        сгруппированы в 5 доменов. Схема — не диагноз, а паттерн, который
        когда-то помогал выжить и приспособиться.
      </p>
      {SCHEMA_DOMAINS.map((d) => (
        <div key={d.domain} style={{ marginBottom: 12 }}>
          <div
            onClick={() => setOpen(open === d.domain ? null : d.domain)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(open === d.domain ? null : d.domain);
              }
            }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'rgba(var(--fg-rgb),0.05)',
              borderRadius: open === d.domain ? '14px 14px 0 0' : 14,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: d.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
              >
                {d.domain}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {d.schemas.length}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  transform: open === d.domain ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          {open === d.domain && (
            <div
              style={{
                background: 'rgba(var(--fg-rgb),0.03)',
                borderRadius: '0 0 14px 14px',
                overflow: 'hidden',
              }}
            >
              {d.schemas.map((s, i) => {
                const isHighlighted = s.name === highlight;
                return (
                  <div
                    key={s.name}
                    style={{
                      padding: '11px 16px',
                      borderTop:
                        i > 0 ? '1px solid rgba(var(--fg-rgb),0.05)' : 'none',
                      background: isHighlighted
                        ? `rgba(${hexToRgbStr(d.color)},0.12)`
                        : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: d.color,
                        marginBottom: 3,
                      }}
                    >
                      {s.name}
                      {isHighlighted && ' ◀'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-sub)',
                        lineHeight: 1.5,
                      }}
                    >
                      {(s as { libraryDesc?: string; desc: string })
                        .libraryDesc ?? s.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
