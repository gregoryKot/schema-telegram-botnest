import { avgBarPct } from '../../hooks/useYsqTest';
import type { SchemaInfo, Scores } from './types';

interface Props {
  schemas: SchemaInfo[];
  scores: Scores;
  expanded: boolean;
  setExpanded: (updater: (prev: boolean) => boolean) => void;
}

// Свёрнутый блок «остальные схемы» в результатах теста.
export function YsqInactiveSchemas({
  schemas,
  scores,
  expanded,
  setExpanded,
}: Props) {
  if (schemas.length === 0) return null;

  return (
    <div style={{ marginTop: 4, marginBottom: 12 }}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
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
        <span>Остальные схемы ({schemas.length})</span>
        <span style={{ fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {schemas.map((schema) => {
            const s = scores[schema.name];
            // «На грани»: средний балл близок к порогу 4 —
            // подсвечиваем жёлтым, стоит понаблюдать.
            const mid = s.avg >= 3;
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
                    {s.avg} из 6
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
                      width: `${avgBarPct(s.avg)}%`,
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
