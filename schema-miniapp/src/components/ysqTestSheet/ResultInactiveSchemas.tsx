import type { SchemaInfo, SchemaScore } from '../../hooks/useYsqTest';

interface ResultInactiveSchemasProps {
  inactiveSchemas: SchemaInfo[];
  scores: Record<string, SchemaScore>;
  inactiveExpanded: boolean;
  setInactiveExpanded: (updater: (prev: boolean) => boolean) => void;
}

export function ResultInactiveSchemas({
  inactiveSchemas,
  scores,
  inactiveExpanded,
  setInactiveExpanded,
}: ResultInactiveSchemasProps) {
  if (inactiveSchemas.length === 0) return null;

  return (
    <div style={{ marginTop: 4, marginBottom: 12 }}>
      <button
        onClick={() => setInactiveExpanded((prev) => !prev)}
        style={{
          width: '100%',
          padding: '11px 16px',
          border: 'none',
          borderRadius: 12,
          background: 'rgba(var(--fg-rgb),0.05)',
          color: 'var(--text-sub)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Остальные схемы ({inactiveSchemas.length})</span>
        <span style={{ fontSize: 12 }}>{inactiveExpanded ? '▲' : '▼'}</span>
      </button>
      {inactiveExpanded && (
        <div style={{ marginTop: 8 }}>
          {inactiveSchemas.map((schema) => {
            const s = scores[schema.name];
            const mid = s.pct5plus >= 30 && s.pct5plus <= 50;
            const barColor = mid
              ? 'var(--accent-yellow)'
              : 'rgba(var(--fg-rgb),0.2)';
            return (
              <div
                key={schema.name}
                style={{
                  marginBottom: 8,
                  background: 'rgba(var(--fg-rgb),0.04)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-sub)',
                      flex: 1,
                      paddingRight: 8,
                      lineHeight: 1.3,
                    }}
                  >
                    {schema.name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: barColor,
                      flexShrink: 0,
                    }}
                  >
                    {s.pct5plus}%
                  </div>
                </div>
                <div
                  style={{
                    height: 3,
                    background: 'rgba(var(--fg-rgb),0.1)',
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${s.pct5plus}%`,
                      background: barColor,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
