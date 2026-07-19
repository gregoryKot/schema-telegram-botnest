import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { ClientDetail } from './types';

interface ClinicalSnapshotProps {
  detail: ClientDetail;
}

export function ClinicalSnapshot({ detail }: ClinicalSnapshotProps) {
  const {
    activeSchemaIds,
    activeModeIds,
    concept,
    localConcept,
    setShowConceptSheet,
  } = detail;

  const hasSchemas = activeSchemaIds.length > 0;
  const hasModes = activeModeIds.length > 0;
  const hasGoals = !!(concept?.goals || localConcept.goals);
  const hasTransitions = !!(
    concept?.modeTransitions || localConcept.modeTransitions
  );
  const hasAnything = hasSchemas || hasModes || hasGoals || hasTransitions;
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.03)',
        border: '1px solid rgba(var(--fg-rgb),0.07)',
        borderRadius: 18,
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      {hasAnything ? (
        <>
          {hasGoals && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'var(--text-sub)',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                Цель терапии
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(var(--fg-rgb),0.75)',
                  lineHeight: 1.5,
                }}
              >
                {((concept?.goals || localConcept.goals) ?? '').slice(0, 160)}
                {((concept?.goals || localConcept.goals) ?? '').length > 160
                  ? '...'
                  : ''}
              </div>
            </div>
          )}
          {hasSchemas && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'var(--text-sub)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Схемы ({activeSchemaIds.length})
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 5,
                }}
              >
                {activeSchemaIds.map((id) => {
                  const domain = SCHEMA_DOMAINS.find((d) =>
                    d.schemas.some((s) => s.id === id),
                  );
                  const schema = domain?.schemas.find((s) => s.id === id);
                  return schema ? (
                    <span
                      key={id}
                      style={{
                        fontSize: 12,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: (domain?.color ?? '#888') + '25',
                        color: domain?.color ?? 'rgba(var(--fg-rgb),0.6)',
                      }}
                    >
                      {schema.emoji} {schema.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {hasModes && (
            <div style={{ marginBottom: hasTransitions ? 12 : 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'var(--text-sub)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Карта режимов
              </div>
              {MODE_GROUPS.map((group) => {
                const groupModes = group.items.filter((m) =>
                  activeModeIds.includes(m.id),
                );
                if (groupModes.length === 0) return null;
                return (
                  <div
                    key={group.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: group.color + 'aa',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        flexShrink: 0,
                        minWidth: 68,
                        paddingTop: 4,
                      }}
                    >
                      {group.group.split(':').pop()?.trim() ?? group.group}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4,
                      }}
                    >
                      {groupModes.map((m) => (
                        <span
                          key={m.id}
                          style={{
                            fontSize: 12,
                            padding: '3px 9px',
                            borderRadius: 20,
                            background: group.color + '25',
                            color: group.color,
                          }}
                        >
                          {m.emoji} {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasTransitions && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  color: 'var(--text-sub)',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                Переходы режимов
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.5,
                }}
              >
                {(
                  (concept?.modeTransitions || localConcept.modeTransitions) ??
                  ''
                ).slice(0, 200)}
                {(
                  (concept?.modeTransitions || localConcept.modeTransitions) ??
                  ''
                ).length > 200
                  ? '...'
                  : ''}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowConceptSheet(true)}
            style={{
              marginTop: 12,
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              fontWeight: 500,
            }}
          >
            Редактировать концептуализацию →
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              marginBottom: 10,
            }}
          >
            Концептуализация не заполнена
          </div>
          <button
            onClick={() => setShowConceptSheet(true)}
            style={{
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              border: 'none',
              borderRadius: 12,
              padding: '9px 18px',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Заполнить концептуализацию
          </button>
        </div>
      )}
    </div>
  );
}
