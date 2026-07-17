import type { ClientConceptualization } from '../../api';
import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import type { ClientDetail } from './types';

interface Props {
  concept: ClientConceptualization;
  detail: ClientDetail;
}

export function ConceptHistoryList({ concept, detail }: Props) {
  const { setLocalConcept, setConceptDirty, setShowHistory } = detail;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {concept.history.map((snap, i) => {
          const snapSchemas = (snap.schemaIds ?? [])
            .map((id) => {
              const domain = SCHEMA_DOMAINS.find((d) =>
                d.schemas.some((s) => s.id === id),
              );
              const schema = domain?.schemas.find((s) => s.id === id);
              return schema ? { schema, color: domain!.color } : null;
            })
            .filter(Boolean) as {
            schema: { id: string; name: string; emoji: string };
            color: string;
          }[];
          const textFields = [
            { label: 'Цель', val: snap.goals },
            { label: 'Опыт', val: snap.earlyExperience },
            { label: 'Потребности', val: snap.unmetNeeds },
            { label: 'Триггеры', val: snap.triggers },
            { label: 'Копинг', val: snap.copingStyles },
            { label: 'Переходы', val: snap.modeTransitions },
            { label: 'Проблемы', val: snap.currentProblems },
          ].filter((f) => f.val);
          return (
            <div
              key={i}
              style={{
                background: 'rgba(var(--fg-rgb),0.03)',
                border: '1px solid rgba(var(--fg-rgb),0.06)',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-sub)',
                  }}
                >
                  {fmtDate(snap.savedAt.slice(0, 10))}
                </span>
                <button
                  onClick={() => {
                    setLocalConcept({
                      schemaIds: snap.schemaIds ?? [],
                      modeIds: snap.modeIds ?? [],
                      earlyExperience: snap.earlyExperience ?? '',
                      unmetNeeds: snap.unmetNeeds ?? '',
                      triggers: snap.triggers ?? '',
                      copingStyles: snap.copingStyles ?? '',
                      goals: snap.goals ?? '',
                      currentProblems: snap.currentProblems ?? '',
                      modeTransitions: snap.modeTransitions ?? '',
                    });
                    setConceptDirty(true);
                    setShowHistory(false);
                  }}
                  style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    background:
                      'color-mix(in srgb, var(--accent) 10%, transparent)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Восстановить
                </button>
              </div>
              {snapSchemas.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginBottom: 6,
                  }}
                >
                  {snapSchemas.map(({ schema, color }) => (
                    <span
                      key={schema.id}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: color + '20',
                        color,
                      }}
                    >
                      {schema.emoji} {schema.name}
                    </span>
                  ))}
                </div>
              )}
              {(snap.modeIds ?? []).length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {MODE_GROUPS.map((group) => {
                    const gm = group.items.filter((m) =>
                      (snap.modeIds ?? []).includes(m.id),
                    );
                    if (gm.length === 0) return null;
                    return (
                      <div
                        key={group.id}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4,
                          marginBottom: 3,
                        }}
                      >
                        {gm.map((m) => (
                          <span
                            key={m.id}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 20,
                              background: group.color + '20',
                              color: group.color,
                            }}
                          >
                            {m.emoji} {m.name}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              {textFields.map(({ label, val }) => (
                <div
                  key={label}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-faint)',
                      fontWeight: 600,
                    }}
                  >
                    {label}:{' '}
                  </span>
                  {(val ?? '').slice(0, 140)}
                  {(val ?? '').length > 140 ? '...' : ''}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
