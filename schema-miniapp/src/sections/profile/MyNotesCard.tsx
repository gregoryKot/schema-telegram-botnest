import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';

interface MyNotesCardProps {
  notesCount: { schema: number; mode: number };
  schemaNoteIds: string[];
  modeNoteIds: string[];
  onOpen: () => void;
}

export function MyNotesCard({
  notesCount,
  schemaNoteIds,
  modeNoteIds,
  onOpen,
}: MyNotesCardProps) {
  return (
    <div
      {...pressable(onOpen)}
      className="card"
      style={{
        borderRadius: 20,
        padding: '16px 16px',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Мои записи
        </div>
        <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>›</span>
      </div>

      {notesCount.schema + notesCount.mode === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Личные карточки схем и режимов
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {schemaNoteIds.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  marginBottom: 6,
                }}
              >
                🧩 Схемы
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {schemaNoteIds.map((id) => {
                  const schema = ALL_SCHEMAS.find((s) => s.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background:
                          'color-mix(in srgb, var(--accent) 10%, transparent)',
                        color: 'var(--accent)',
                        fontWeight: 500,
                      }}
                    >
                      {schema?.name ?? id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {modeNoteIds.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  marginBottom: 6,
                }}
              >
                🔄 Режимы
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {modeNoteIds.map((id) => {
                  const mode = ALL_MODES.find((m) => m.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        borderRadius: 8,
                        background:
                          'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
                        color: 'var(--accent-blue)',
                        fontWeight: 500,
                      }}
                    >
                      {mode?.name ?? id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
