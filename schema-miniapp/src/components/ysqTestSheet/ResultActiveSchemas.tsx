import {
  NEED_LABELS,
  TIP_VY,
  type ResultViewDomain,
  type SchemaScore,
} from '../../hooks/useYsqTest';

interface ResultActiveSchemasProps {
  activeByDomain: ResultViewDomain[];
  scores: Record<string, SchemaScore>;
  ratings?: Record<string, number>;
  getSchemaDelta: (schemaName: string) => number | null;
  tr: (ty: string, vy: string) => string;
  onViewSchemas?: (schemaName: string) => void;
  onClose: () => void;
}

export function ResultActiveSchemas({
  activeByDomain,
  scores,
  ratings,
  getSchemaDelta,
  tr,
  onViewSchemas,
  onClose,
}: ResultActiveSchemasProps) {
  return (
    <>
      {activeByDomain.map((domain) => (
        <div key={domain.needId} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-sub)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {domain.label}
          </div>
          {domain.schemas.map((schema) => {
            const s = scores[schema.name];
            const color = schema.color;
            const diaryRating = ratings?.[schema.needId];
            const showDiaryHint = diaryRating !== undefined && diaryRating <= 4;
            const delta = getSchemaDelta(schema.name);
            return (
              <div
                key={schema.name}
                style={{
                  marginBottom: 10,
                  background: `color-mix(in srgb, ${color} 10%, transparent)`,
                  borderRadius: 16,
                  padding: '14px 16px',
                  border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                        lineHeight: 1.35,
                      }}
                    >
                      {schema.name}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    {delta !== null && Math.abs(delta) >= 5 && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            delta < 0
                              ? 'var(--accent-green)'
                              : 'var(--accent-red)',
                        }}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}%
                      </span>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color }}>
                      {s.pct5plus}%
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    height: 3,
                    background: 'rgba(var(--fg-rgb),0.1)',
                    borderRadius: 2,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${s.pct5plus}%`,
                      background: color,
                      borderRadius: 2,
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.55,
                    marginBottom: 8,
                  }}
                >
                  {schema.desc}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    background: 'rgba(var(--fg-rgb),0.05)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-sub)',
                      lineHeight: 1.5,
                    }}
                  >
                    {tr(schema.tip, TIP_VY[schema.name] ?? schema.tip)}
                  </span>
                </div>

                <div
                  onClick={() =>
                    onViewSchemas ? onViewSchemas(schema.name) : onClose()
                  }
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '4px 0',
                    marginBottom: showDiaryHint ? 8 : 0,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--accent)' }}>
                    Читать карточку схемы
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--accent)' }}>
                    ›
                  </span>
                </div>

                {showDiaryHint && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--accent-yellow)',
                      lineHeight: 1.4,
                      padding: '6px 10px',
                      background: 'rgba(250,204,21,0.1)',
                      borderRadius: 8,
                    }}
                  >
                    ⚡ Совпадает с дневником: «{NEED_LABELS[schema.needId]}»
                    стабильно низкая
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
