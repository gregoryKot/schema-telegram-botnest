import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { SchemaNote, hex, notePreview } from './shared';

// Список карточек схем клиента, сгруппированных по доменам ЭДС.
// Вынесено из MyNotesSheet.tsx (правило №10).
export function MyNotesSchemaCards({
  allSchemaIds,
  schemaNotes,
  onOpenSchema,
}: {
  allSchemaIds: string[];
  schemaNotes: SchemaNote[];
  onOpenSchema: (id: string) => void;
}) {
  if (allSchemaIds.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 10,
        }}
      >
        Схемы · {allSchemaIds.length}
      </div>
      {SCHEMA_DOMAINS.map((domain) => {
        const domainSchemas = domain.schemas.filter((s) =>
          allSchemaIds.includes(s.id),
        );
        if (domainSchemas.length === 0) return null;
        const colorHex = hex(domain.color);
        return (
          <div key={domain.id} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: domain.color,
                opacity: 0.75,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {domain.domain}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {domainSchemas.map((s) => {
                const note = schemaNotes.find((n) => n.schemaId === s.id);
                const filled =
                  note &&
                  Object.entries(note).some(
                    ([k, v]) =>
                      k !== 'schemaId' && typeof v === 'string' && v.trim(),
                  );
                return (
                  <div
                    key={s.id}
                    onClick={() => onOpenSchema(s.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenSchema(s.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: `${colorHex}0d`,
                      border: `1px solid ${colorHex}22`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: `${colorHex}18`,
                        border: `1px solid ${colorHex}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      {s.emoji ?? '●'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text)',
                          lineHeight: 1.2,
                        }}
                      >
                        {s.name}
                      </div>
                      {filled && note ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: domain.color,
                            marginTop: 2,
                          }}
                        >
                          Заполнено · {notePreview(note).slice(0, 35)}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-faint)',
                            marginTop: 2,
                          }}
                        >
                          Заполнить карточку →
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        color: 'var(--text-faint)',
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
